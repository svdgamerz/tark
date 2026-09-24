//! High-precision Gauss-Legendre Quadrature for Special Functions & Physics Integrals.

/// Generates nodes and weights for n-point Gauss-Legendre quadrature on [-1, 1].
pub fn legendre_nodes_weights(n: usize) -> (Vec<f64>, Vec<f64>) {
    let mut x = vec![0.0; n];
    let mut w = vec![0.0; n];
    let m = (n + 1) / 2;

    for i in 0..m {
        // Initial Chebyshev-Gauss estimate
        let mut z = (std::f64::consts::PI * (i as f64 + 0.75) / (n as f64 + 0.5)).cos();
        let mut pp = 0.0;

        // Newton-Raphson iteration
        for _ in 0..100 {
            let mut p1 = 1.0;
            let mut p2 = 0.0;
            for j in 1..=n {
                let p3 = p2;
                p2 = p1;
                p1 = ((2.0 * j as f64 - 1.0) * z * p2 - (j as f64 - 1.0) * p3) / (j as f64);
            }
            pp = (n as f64) * (z * p1 - p2) / (z * z - 1.0);
            let z1 = z;
            z = z1 - p1 / pp;
            if (z - z1).abs() < 1e-15 {
                break;
            }
        }

        x[i] = -z;
        x[n - 1 - i] = z;
        w[i] = 2.0 / ((1.0 - z * z) * pp * pp);
        w[n - 1 - i] = w[i];
    }

    (x, w)
}

/// Evaluates integral of f(x) over [a, b] using N-point Gauss-Legendre quadrature.
pub fn integrate_gauss_legendre<F>(f: F, a: f64, b: f64, n: usize) -> f64
where
    F: Fn(f64) -> f64,
{
    let (nodes, weights) = legendre_nodes_weights(n);
    let half_len = 0.5 * (b - a);
    let mid = 0.5 * (a + b);

    let mut sum = 0.0;
    for i in 0..n {
        let t = mid + half_len * nodes[i];
        sum += weights[i] * f(t);
    }

    half_len * sum
}

/// Evaluates the Fermi-Dirac integral of order 1/2:
/// F_{1/2}(eta) = \int_0^\infty \frac{t^{1/2}}{e^{t - eta} + 1} dt
pub fn gauss_legendre_fermi_dirac(eta: f64, n_points: usize) -> f64 {
    // Transform t = u / (1 - u) from u in [0, 1] to t in [0, inf)
    // dt = du / (1 - u)^2
    integrate_gauss_legendre(
        |u| {
            if u <= 0.0 || u >= 1.0 {
                return 0.0;
            }
            let t = u / (1.0 - u);
            let dt_du = 1.0 / ((1.0 - u) * (1.0 - u));
            let denom = (t - eta).exp() + 1.0;
            if denom.is_infinite() {
                0.0
            } else {
                (t.sqrt() / denom) * dt_du
            }
        },
        1e-7,
        1.0 - 1e-7,
        n_points,
    )
}

/// Evaluates the Debye Heat Capacity Function:
/// D_3(x) = (3 / x^3) * \int_0^x \frac{t^4 e^t}{(e^t - 1)^2} dt
pub fn gauss_legendre_debye(x: f64, n_points: usize) -> f64 {
    if x <= 1e-6 {
        return 1.0; // Limit as x -> 0 is 1.0
    }

    let integral = integrate_gauss_legendre(
        |t| {
            if t <= 1e-8 {
                return 0.0;
            }
            let exp_t = t.exp();
            let denom = exp_t - 1.0;
            (t.powi(4) * exp_t) / (denom * denom)
        },
        0.0,
        x,
        n_points,
    );

    (3.0 / x.powi(3)) * integral
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fermi_dirac() {
        let fd0 = gauss_legendre_fermi_dirac(0.0, 64);
        // F_{1/2}(0) = (1 - 2^{-1/2}) * \zeta(3/2) * \Gamma(3/2) \approx 0.678093...
        assert!((fd0 - 0.678).abs() < 0.01, "Expected ~0.678, got {}", fd0);
    }

    #[test]
    fn test_debye() {
        let d = gauss_legendre_debye(1.0, 64);
        // Debye D_3(1) \approx 0.9255
        assert!((d - 0.9255).abs() < 0.01, "Expected ~0.9255, got {}", d);
    }
}
