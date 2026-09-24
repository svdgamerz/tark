//! In-place Radix-2 Cooley-Tukey Fast Fourier Transform (FFT).

use std::f64::consts::PI;

/// Computes the in-place Radix-2 FFT (or inverse FFT if `inverse` is true).
/// Length of `re` and `im` must be equal and a power of 2.
pub fn fft_radix2(re: &mut [f64], im: &mut [f64], inverse: bool) {
    let n = re.len();
    assert_eq!(n, im.len());
    assert!(n > 0 && (n & (n - 1)) == 0, "FFT size must be a power of 2");

    // 1. Bit-reversal permutation
    let mut j = 0;
    for i in 0..(n - 1) {
        if i < j {
            re.swap(i, j);
            im.swap(i, j);
        }
        let mut k = n >> 1;
        while k <= j {
            j -= k;
            k >>= 1;
        }
        j += k;
    }

    // 2. Cooley-Tukey butterfly computation
    let sign = if inverse { 1.0 } else { -1.0 };
    let mut len = 2;
    while len <= n {
        let half_len = len / 2;
        let angle = sign * 2.0 * PI / (len as f64);
        let w_step_re = angle.cos();
        let w_step_im = angle.sin();

        let mut i = 0;
        while i < n {
            let mut w_re = 1.0;
            let mut w_im = 0.0;

            for k in 0..half_len {
                let u_re = re[i + k];
                let u_im = im[i + k];

                let v_re = re[i + k + half_len] * w_re - im[i + k + half_len] * w_im;
                let v_im = re[i + k + half_len] * w_im + im[i + k + half_len] * w_re;

                re[i + k] = u_re + v_re;
                im[i + k] = u_im + v_im;

                re[i + k + half_len] = u_re - v_re;
                im[i + k + half_len] = u_im - v_im;

                let next_w_re = w_re * w_step_re - w_im * w_step_im;
                let next_w_im = w_re * w_step_im + w_im * w_step_re;
                w_re = next_w_re;
                w_im = next_w_im;
            }

            i += len;
        }

        len <<= 1;
    }

    // Normalize if inverse
    if inverse {
        let inv_n = 1.0 / (n as f64);
        for i in 0..n {
            re[i] *= inv_n;
            im[i] *= inv_n;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fft_roundtrip() {
        let mut re = vec![1.0, 2.0, 3.0, 4.0, 0.0, 0.0, 0.0, 0.0];
        let mut im = vec![0.0; 8];
        let original_re = re.clone();

        fft_radix2(&mut re, &mut im, false);
        fft_radix2(&mut re, &mut im, true);

        for i in 0..8 {
            assert!((re[i] - original_re[i]).abs() < 1e-10);
            assert!(im[i].abs() < 1e-10);
        }
    }
}
