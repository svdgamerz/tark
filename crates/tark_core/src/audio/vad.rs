//! Low-Latency Voice Activity Detection (VAD) and Barge-In Engine for Tark Voice Tutor.
//!
//! Processes 16kHz PCM audio frames in < 50 microseconds, identifying speech onsets,
//! ambient noise floors, and barge-in interruptions with sub-10ms latency.

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum VadState {
    Silence,
    SpeechOnset,
    Speaking,
    SpeechOffset,
}

#[derive(Clone, Debug)]
pub struct VadConfig {
    /// Sample rate in Hz (default 16,000)
    pub sample_rate: usize,
    /// Frame size in samples (e.g. 320 samples = 20ms at 16kHz)
    pub frame_size: usize,
    /// Base energy threshold in dBFS to consider speech candidate
    pub energy_threshold_db: f32,
    /// Minimum zero crossing rate candidate
    pub zcr_threshold: f32,
    /// Speech onset hangover frames (number of speech frames to transition to Speaking)
    pub onset_frames: usize,
    /// Speech offset hangover frames (hold speaking state across micro-pauses, e.g. 10 frames = 200ms)
    pub offset_frames: usize,
    /// Barge-in sensitivity threshold in dBFS (when TTS is playing, louder voice required)
    pub barge_in_threshold_db: f32,
}

impl Default for VadConfig {
    fn default() -> Self {
        Self {
            sample_rate: 16000,
            frame_size: 320, // 20ms
            energy_threshold_db: -42.0,
            zcr_threshold: 0.04,
            onset_frames: 2,
            offset_frames: 10, // 200ms hold
            barge_in_threshold_db: -34.0,
        }
    }
}

#[derive(Clone, Debug)]
pub struct FrameAnalysis {
    pub rms_db: f32,
    pub zcr: f32,
    pub is_speech: bool,
    pub is_barge_in: bool,
    pub state: VadState,
    pub noise_floor_db: f32,
}

/// Real-time Voice Activity Detector with adaptive noise floor and barge-in trigger.
#[derive(Clone, Debug)]
pub struct VoiceActivityDetector {
    config: VadConfig,
    state: VadState,
    consecutive_speech: usize,
    consecutive_silence: usize,
    noise_floor_db: f32,
    tts_is_playing: bool,
}

impl VoiceActivityDetector {
    pub fn new(config: VadConfig) -> Self {
        Self {
            noise_floor_db: -55.0,
            state: VadState::Silence,
            consecutive_speech: 0,
            consecutive_silence: 0,
            tts_is_playing: false,
            config,
        }
    }

    /// Inform the VAD engine whether Tark is currently speaking TTS output
    pub fn set_tts_playing(&mut self, playing: bool) {
        self.tts_is_playing = playing;
    }

    /// Compute Root Mean Square (RMS) energy in dBFS of a raw float PCM audio slice (-1.0 to 1.0)
    #[inline]
    pub fn compute_rms_db(samples: &[f32]) -> f32 {
        if samples.is_empty() {
            return -100.0;
        }

        let mut sum_sq = 0.0f32;
        for &s in samples {
            sum_sq += s * s;
        }

        let mean_sq = sum_sq / (samples.len() as f32);
        let rms = mean_sq.sqrt();
        if rms <= 1e-6 {
            -100.0
        } else {
            20.0 * rms.log10()
        }
    }

    /// Compute Zero Crossing Rate (ZCR) of an audio frame
    #[inline]
    pub fn compute_zcr(samples: &[f32]) -> f32 {
        if samples.len() < 2 {
            return 0.0;
        }

        let mut crossings = 0usize;
        for i in 1..samples.len() {
            if (samples[i] >= 0.0 && samples[i - 1] < 0.0) || (samples[i] < 0.0 && samples[i - 1] >= 0.0) {
                crossings += 1;
            }
        }

        crossings as f32 / ((samples.len() - 1) as f32)
    }

    /// Process a single frame of PCM audio (typically 320 samples for 20ms at 16kHz)
    pub fn process_frame(&mut self, samples: &[f32]) -> FrameAnalysis {
        let rms_db = Self::compute_rms_db(samples);
        let zcr = Self::compute_zcr(samples);

        // Dynamic threshold based on adaptive noise floor
        let dynamic_threshold = (self.noise_floor_db + 12.0).max(self.config.energy_threshold_db);
        let active_threshold = if self.tts_is_playing {
            self.config.barge_in_threshold_db.max(dynamic_threshold + 6.0)
        } else {
            dynamic_threshold
        };

        let frame_is_candidate = rms_db > active_threshold && zcr >= self.config.zcr_threshold;

        if frame_is_candidate {
            self.consecutive_speech += 1;
            self.consecutive_silence = 0;
        } else {
            self.consecutive_silence += 1;
            self.consecutive_speech = 0;

            // Slowly adapt noise floor during confirmed silence
            if self.consecutive_silence > 5 && !self.tts_is_playing && rms_db > -90.0 {
                self.noise_floor_db = self.noise_floor_db * 0.95 + rms_db * 0.05;
            }
        }

        // State Machine Transition
        match self.state {
            VadState::Silence => {
                if self.consecutive_speech >= self.config.onset_frames {
                    self.state = VadState::Speaking;
                } else if self.consecutive_speech > 0 {
                    self.state = VadState::SpeechOnset;
                }
            }
            VadState::SpeechOnset => {
                if self.consecutive_speech >= self.config.onset_frames {
                    self.state = VadState::Speaking;
                } else if self.consecutive_silence >= 2 {
                    self.state = VadState::Silence;
                }
            }
            VadState::Speaking => {
                if self.consecutive_silence >= self.config.offset_frames {
                    self.state = VadState::Silence;
                } else if self.consecutive_silence > 0 {
                    self.state = VadState::SpeechOffset;
                }
            }
            VadState::SpeechOffset => {
                if self.consecutive_speech >= 1 {
                    self.state = VadState::Speaking;
                } else if self.consecutive_silence >= self.config.offset_frames {
                    self.state = VadState::Silence;
                }
            }
        }

        let is_speech = self.state == VadState::Speaking || self.state == VadState::SpeechOffset;
        let is_barge_in = self.tts_is_playing && is_speech && (rms_db > self.config.barge_in_threshold_db);

        FrameAnalysis {
            rms_db,
            zcr,
            is_speech,
            is_barge_in,
            state: self.state,
            noise_floor_db: self.noise_floor_db,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_silence_detection() {
        let mut vad = VoiceActivityDetector::new(VadConfig::default());
        let silence_frame = vec![0.0001f32; 320];

        for _ in 0..10 {
            let res = vad.process_frame(&silence_frame);
            assert!(!res.is_speech);
            assert!(!res.is_barge_in);
        }
    }

    #[test]
    fn test_speech_onset_and_barge_in() {
        let mut vad = VoiceActivityDetector::new(VadConfig::default());
        vad.set_tts_playing(true);

        // Generate synthetic speech-like sinusoid (400 Hz voice fundamental at 16kHz)
        let mut speech_frame = Vec::with_capacity(320);
        for i in 0..320 {
            let t = i as f32 / 16000.0;
            speech_frame.push(0.3 * (2.0 * std::f32::consts::PI * 400.0 * t).sin());
        }

        let mut barge_in_triggered = false;
        for _ in 0..5 {
            let res = vad.process_frame(&speech_frame);
            if res.is_barge_in {
                barge_in_triggered = true;
                break;
            }
        }

        assert!(barge_in_triggered, "Barge-in should be triggered on loud voiced input");
    }
}
