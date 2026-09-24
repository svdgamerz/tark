//! Durand-Kerner (Weierstrass) simultaneous polynomial complex root solver.

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Complex {
    pub re: f64,
    pub im: f64,
}

impl Complex {
    pub fn new(re: f64, im: f64) -> Self {
        Self { re, im }
    }

    pub fn add(self, other: Self) -> Self {
        Self { re: self.re + other.re, im: self.im + other.im }
    }

    pub fn sub(self, other: Self) -> Self {
        Self { re: self.re - other.re, im: self.im - other.im }
    }

    pub fn mul(self, other: Self) -> Self {
        Self {
            re: self.re * other.re - self.im * other.im,
            im: self.re * other.im + self.im * other.re,
        }
    }

    pub fn div(self, other: Self) -> Self {
        let den = other.re * other.re + other.im * other.im;
        Self {
            re: (self.re * other.re + self.im * other.im) / den,
            im: (self.im * other.re - self.re * other.im) / den,
        }
    }

    pub fn abs_sq(self) -> f64 {
        self.re * self.re + self.im * self.im
    }
}

/// Evaluates polynomial P(z) = z^n + a_{n-1}z^{n-1} + ... + a_0
/// `coeffs` contains [a_0, a_1, ..., a_{n-1}]. The leading coefficient a_n is assumed to be 1.0.
fn eval_poly(coeffs: &[f64], z: Complex) -> Complex {
    let mut result = Complex::new(1.0, 0.0); // leading term z^n evaluated via Horner's method
    // In Horner's form: ((z + a_{n-1})z + a_{n-2})z ... + a_0
    for &c in coeffs.iter().rev() {
        result = result.mul(z).add(Complex::new(c, 0.0));
    }
    result
}

/// Finds all complex roots of a monic polynomial P(z) = z^n + sum(coeffs[i] * z^i) = 0
/// using the Durand-Kerner iterative method.
pub fn durand_kerner_roots(coeffs: &[f64], max_iter: usize, tol: f64) -> Vec<(f64, f64)> {
    let n = coeffs.len();
    if n == 0 {
        return Vec::new();
    }

    // Initial root approximations on Aberth circle: z_k = (0.4 + 0.9i)^k
    let base = Complex::new(0.4, 0.9);
    let mut roots = Vec::with_capacity(n);
    let mut current = Complex::new(1.0, 0.0);

    for _ in 0..n {
        current = current.mul(base);
        roots.push(current);
    }

    let tol_sq = tol * tol;

    for _ in 0..max_iter {
        let mut max_change_sq = 0.0f64;

        for i in 0..n {
            let zi = roots[i];
            let p_zi = eval_poly(coeffs, zi);

            let mut denom = Complex::new(1.0, 0.0);
            for j in 0..n {
                if i != j {
                    denom = denom.mul(zi.sub(roots[j]));
                }
            }

            let delta = p_zi.div(denom);
            roots[i] = zi.sub(delta);

            let change_sq = delta.abs_sq();
            if change_sq > max_change_sq {
                max_change_sq = change_sq;
            }
        }

        if max_change_sq < tol_sq {
            break;
        }
    }

    roots.into_iter().map(|c| (c.re, c.im)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_roots_quadratic() {
        // P(z) = z^2 - 1 = 0 => coeffs = [-1.0, 0.0]
        let roots = durand_kerner_roots(&[-1.0, 0.0], 100, 1e-10);
        assert_eq!(roots.len(), 2);
        // Roots should be +1 and -1
        let mut real_parts: Vec<f64> = roots.iter().map(|(re, _)| *re).collect();
        real_parts.sort_by(|a, b| a.partial_cmp(b).unwrap());
        assert!((real_parts[0] - (-1.0)).abs() < 1e-6);
        assert!((real_parts[1] - 1.0).abs() < 1e-6);
    }
}
