//! Non-linear chaotic dynamics: Lorenz Attractor & Maximal Lyapunov Exponent.

#[inline(always)]
fn lorenz_deriv(x: f64, y: f64, z: f64, sigma: f64, rho: f64, beta: f64) -> (f64, f64, f64) {
    let dx = sigma * (y - x);
    let dy = x * (rho - z) - y;
    let dz = x * y - beta * z;
    (dx, dy, dz)
}

#[inline(always)]
fn rk4_step(
    x: &mut f64,
    y: &mut f64,
    z: &mut f64,
    dt: f64,
    sigma: f64,
    rho: f64,
    beta: f64,
) {
    let (k1x, k1y, k1z) = lorenz_deriv(*x, *y, *z, sigma, rho, beta);

    let (k2x, k2y, k2z) = lorenz_deriv(
        *x + 0.5 * dt * k1x,
        *y + 0.5 * dt * k1y,
        *z + 0.5 * dt * k1z,
        sigma,
        rho,
        beta,
    );

    let (k3x, k3y, k3z) = lorenz_deriv(
        *x + 0.5 * dt * k2x,
        *y + 0.5 * dt * k2y,
        *z + 0.5 * dt * k2z,
        sigma,
        rho,
        beta,
    );

    let (k4x, k4y, k4z) = lorenz_deriv(
        *x + dt * k3x,
        *y + dt * k3y,
        *z + dt * k3z,
        sigma,
        rho,
        beta,
    );

    *x += (dt / 6.0) * (k1x + 2.0 * k2x + 2.0 * k3x + k4x);
    *y += (dt / 6.0) * (k1y + 2.0 * k2y + 2.0 * k3y + k4y);
    *z += (dt / 6.0) * (k1z + 2.0 * k2z + 2.0 * k3z + k4z);
}

/// Simulates the Lorenz attractor and returns sampled trajectory points (x, y, z).
pub fn simulate_lorenz_attractor(
    mut x: f64,
    mut y: f64,
    mut z: f64,
    sigma: f64,
    rho: f64,
    beta: f64,
    dt: f64,
    steps: usize,
    sample_stride: usize,
) -> Vec<[f64; 3]> {
    let mut trajectory = Vec::with_capacity((steps / sample_stride.max(1)) + 1);
    trajectory.push([x, y, z]);

    for step in 1..=steps {
        rk4_step(&mut x, &mut y, &mut z, dt, sigma, rho, beta);
        if step % sample_stride == 0 {
            trajectory.push([x, y, z]);
        }
    }

    trajectory
}

/// Computes the Maximal Lyapunov Exponent (MLE) of the Lorenz system.
/// A positive value indicates deterministic chaos.
pub fn compute_lyapunov_exponent(
    mut x: f64,
    mut y: f64,
    mut z: f64,
    sigma: f64,
    rho: f64,
    beta: f64,
    dt: f64,
    total_steps: usize,
) -> f64 {
    // Warm up onto the strange attractor
    for _ in 0..10_000 {
        rk4_step(&mut x, &mut y, &mut z, dt, sigma, rho, beta);
    }

    let d0 = 1e-8;
    // Initial perturbed state
    let mut px = x + d0;
    let mut py = y;
    let mut pz = z;

    let mut lyap_sum = 0.0;

    for _ in 0..total_steps {
        rk4_step(&mut x, &mut y, &mut z, dt, sigma, rho, beta);
        rk4_step(&mut px, &mut py, &mut pz, dt, sigma, rho, beta);

        let dx = px - x;
        let dy = py - y;
        let dz = pz - z;
        let d1 = (dx * dx + dy * dy + dz * dz).sqrt();

        if d1 > 0.0 {
            lyap_sum += (d1 / d0).ln();
            // Renormalize separation back to d0 along the divergence vector
            let scale = d0 / d1;
            px = x + dx * scale;
            py = y + dy * scale;
            pz = z + dz * scale;
        }
    }

    lyap_sum / (total_steps as f64 * dt)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lyapunov_exponent_positive() {
        // Standard chaotic parameters
        let lambda = compute_lyapunov_exponent(1.0, 1.0, 1.0, 10.0, 28.0, 8.0 / 3.0, 0.005, 50_000);
        // Lorenz MLE should be positive (~0.90)
        assert!(lambda > 0.5 && lambda < 1.5, "Expected positive Lyapunov exponent ~0.9, got {}", lambda);
    }
}
