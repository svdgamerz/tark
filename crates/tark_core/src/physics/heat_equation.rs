//! 2D Heat Diffusion PDE solver using the Finite Difference Method (FDM).

/// Solves the 2D heat equation: du/dt = alpha * (d2u/dx2 + d2u/dy2)
/// on an N x N grid with Dirichlet boundary conditions over `steps` iterations.
/// Returns flattened final temperature grid and maximum temperature.
pub fn simulate_heat_2d_fdm(
    grid_size: usize,
    alpha: f64,
    dx: f64,
    dt: f64,
    steps: usize,
    initial_heat_center: f64,
) -> (Vec<f64>, f64) {
    let n = grid_size;
    let mut u = vec![0.0; n * n];
    let mut u_next = vec![0.0; n * n];

    // Set initial temperature spike in center
    let center = n / 2;
    for i in (center.saturating_sub(4))..=(center + 4).min(n - 1) {
        for j in (center.saturating_sub(4))..=(center + 4).min(n - 1) {
            u[i * n + j] = initial_heat_center;
        }
    }

    let gamma = alpha * dt / (dx * dx);

    for _ in 0..steps {
        for i in 1..(n - 1) {
            let row = i * n;
            let row_up = (i - 1) * n;
            let row_down = (i + 1) * n;

            for j in 1..(n - 1) {
                let center_val = u[row + j];
                let laplacian = u[row + j + 1] + u[row + j - 1] + u[row_down + j] + u[row_up + j] - 4.0 * center_val;
                u_next[row + j] = center_val + gamma * laplacian;
            }
        }

        // Keep boundary conditions at 0.0
        for k in 0..n {
            u_next[k] = 0.0;             // top
            u_next[(n - 1) * n + k] = 0.0; // bottom
            u_next[k * n] = 0.0;         // left
            u_next[k * n + n - 1] = 0.0; // right
        }

        std::mem::swap(&mut u, &mut u_next);
    }

    let max_temp = u.iter().copied().fold(0.0f64, f64::max);
    (u, max_temp)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_heat_diffusion() {
        let (grid, max_t) = simulate_heat_2d_fdm(32, 0.2, 1.0, 0.5, 100, 100.0);
        assert_eq!(grid.len(), 32 * 32);
        assert!(max_t < 100.0); // Heat diffused outward
        assert!(max_t > 0.0);
    }
}
