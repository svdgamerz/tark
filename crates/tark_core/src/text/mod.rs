//! High-speed zero-copy text chunker for textbooks and syllabus documents in Tark.

/// Splits text into overlapping chunks respecting sentence and paragraph boundaries.
pub fn chunk_text_fast(text: &str, target_chunk_size: usize, overlap: usize) -> Vec<String> {
    if text.is_empty() {
        return Vec::new();
    }

    let mut chunks = Vec::new();
    let paragraphs: Vec<&str> = text.split("\n\n").map(|p| p.trim()).filter(|p| !p.is_empty()).collect();

    let mut current_chunk = String::with_capacity(target_chunk_size + overlap);

    for p in paragraphs {
        if current_chunk.len() + p.len() + 2 <= target_chunk_size {
            if !current_chunk.is_empty() {
                current_chunk.push_str("\n\n");
            }
            current_chunk.push_str(p);
        } else if p.len() > target_chunk_size {
            // Paragraph itself exceeds target size, split by sentences
            let sentences = split_sentences(p);
            for s in sentences {
                if current_chunk.len() + s.len() + 1 <= target_chunk_size {
                    if !current_chunk.is_empty() {
                        current_chunk.push(' ');
                    }
                    current_chunk.push_str(s);
                } else {
                    if !current_chunk.is_empty() {
                        chunks.push(current_chunk.clone());
                        // Keep overlap from the end of current chunk
                        let overlap_start = current_chunk.len().saturating_sub(overlap);
                        current_chunk = current_chunk[overlap_start..].trim_start().to_string();
                    }
                    if !current_chunk.is_empty() {
                        current_chunk.push(' ');
                    }
                    current_chunk.push_str(s);
                }
            }
        } else {
            // Push current chunk and start new one with overlap
            if !current_chunk.is_empty() {
                chunks.push(current_chunk.clone());
                let overlap_start = current_chunk.len().saturating_sub(overlap);
                current_chunk = current_chunk[overlap_start..].trim_start().to_string();
            }
            if !current_chunk.is_empty() {
                current_chunk.push_str("\n\n");
            }
            current_chunk.push_str(p);
        }
    }

    if !current_chunk.is_empty() {
        chunks.push(current_chunk);
    }

    chunks
}

fn split_sentences(text: &str) -> Vec<&str> {
    let mut sentences = Vec::new();
    let mut start = 0;
    let bytes = text.as_bytes();

    for i in 0..bytes.len() {
        if bytes[i] == b'.' || bytes[i] == b'?' || bytes[i] == b'!' {
            // Check if followed by space or end
            if i + 1 == bytes.len() || bytes[i + 1] == b' ' || bytes[i + 1] == b'\n' {
                let sent = text[start..=i].trim();
                if !sent.is_empty() {
                    sentences.push(sent);
                }
                start = i + 1;
            }
        }
    }

    if start < text.len() {
        let remaining = text[start..].trim();
        if !remaining.is_empty() {
            sentences.push(remaining);
        }
    }

    if sentences.is_empty() {
        vec![text]
    } else {
        sentences
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chunk_text() {
        let text = "First sentence here. Second sentence follows. Third sentence wraps up.";
        let chunks = chunk_text_fast(text, 50, 10);
        assert!(!chunks.is_empty());
        assert!(chunks.iter().all(|c| !c.is_empty()));
    }
}
