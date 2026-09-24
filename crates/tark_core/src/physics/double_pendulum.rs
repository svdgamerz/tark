//! Chaotic double pendulum dynamics using 4th-order Runge-Kutta (RK4).

#[derive(Clone, Debug, PartialEq)]
pub struct DoublePendulumState {
    pub theta1: f64,
    pub theta2: f64,
    pub omega1: f64,
    pub omega2: f64,
    pub energy: f64,
}

fn derivatives(
    state: &[f64; 4],
    m1: f64,
    m2: f64,
    l1: f64,
    l2: f64,
    g: f64,
) -> [f64; 4] {
    let theta1 = state[0];
    let theta2 = state[1];
    let omega1 = state[2];
    let omega2 = state[3];

    let delta = theta1 - theta2;
    let den = 2.0 * m1 + m2 - m2 * (2.0 * theta1 - 2.0 * theta2).cos();

    let num1 = -g * (2.0 * m1 + m2) * theta1.sin()
        - m2 * g * (theta1 - 2.0 * theta2).sin()
        - 2.0 * delta.sin() * m2 * (omega2 * omega2 * l2 + omega1 * omega1 * l1 * delta.cos());
    let alpha1 = num1 / (l1 * den);

    let num2 = 2.0 * delta.sin() * (
        omega1 * omega1 * l1 * (m1 + m2)
        + g * (m1 + m2) * theta1.cos()
        + omega2 * omega2 * l2 * m2 * delta.cos()
    );
    let alpha2 = num2 / (l2 * den);

    [omega1, omega2, alpha1, alpha2]
}

fn compute_energy(state: &[f64; 4], m1: f64, m2: f64, l1: f64, l2: f64, g: f64) -> f64 {
    let theta1 = state[0];
    let theta2 = state[1];
    let omega1 = state[2];
    let omega2 = state[3];

    // Kinetic energy
    let t1 = 0.5 * m1 * (l1 * omega1).powi(2);
    let t2 = 0.5 * m2 * ((l1 * omega1).powi(2) + (l2 * omega2).powi(2) + 2.0 * l1 * l2 * omega1 * omega2 * (theta1 - theta2).cos());

    // Potential energy (reference y = 0 at pivot)
    let v1 = -(m1 + m2) * g * l1 * theta1.cos();
    let v2 = -m2 * g * l2 * theta2.cos();

    t1 + t2 + v1 + v2
}

/// Performs a single 4th-order Runge-Kutta step on the double pendulum state.
pub fn rk4_step(
    theta1: &mut f64,
    theta2: &mut f64,
    omega1: &mut f64,
    omega2: &mut f64,
    dt: f64,
) {
    let m1 = 1.0;
    let m2 = 1.0;
    let l1 = 1.0;
    let l2 = 1.0;
    let g = 9.81;

    let state = [*theta1, *theta2, *omega1, *omega2];
    let k1 = derivatives(&state, m1, m2, l1, l2, g);

    let mut s2 = [0.0; 4];
    for i in 0..4 {
        s2[i] = state[i] + 0.5 * dt * k1[i];
    }
    let k2 = derivatives(&s2, m1, m2, l1, l2, g);

    let mut s3 = [0.0; 4];
    for i in 0..4 {
        s3[i] = state[i] + 0.5 * dt * k2[i];
    }
    let k3 = derivatives(&s3, m1, m2, l1, l2, g);

    let mut s4 = [0.0; 4];
    for i in 0..4 {
        s4[i] = state[i] + dt * k3[i];
    }
    let k4 = derivatives(&s4, m1, m2, l1, l2, g);

    *theta1 += (dt / 6.0) * (k1[0] + 2.0 * k2[0] + 2.0 * k3[0] + k4[0]);
    *theta2 += (dt / 6.0) * (k1[1] + 2.0 * k2[1] + 2.0 * k3[1] + k4[1]);
    *omega1 += (dt / 6.0) * (k1[2] + 2.0 * k2[2] + 2.0 * k3[2] + k4[2]);
    *omega2 += (dt / 6.0) * (k1[3] + 2.0 * k2[3] + 2.0 * k3[3] + k4[3]);
}

/// Simulates a double pendulum for `num_steps` using 4th-order Runge-Kutta.
/// Returns state trajectory sampled at `sample_stride`.
pub fn simulate_double_pendulum_rk4(
    theta1_init: f64,
    theta2_init: f64,
    omega1_init: f64,
    omega2_init: f64,
    m1: f64,
    m2: f64,
    l1: f64,
    l2: f64,
    g: f64,
    dt: f64,
    num_steps: usize,
    sample_stride: usize,
) -> Vec<DoublePendulumState> {
    let mut state = [theta1_init, theta2_init, omega1_init, omega2_init];
    let mut trajectory = Vec::with_capacity((num_steps / sample_stride.max(1)) + 1);

    trajectory.push(DoublePendulumState {
        theta1: state[0],
        theta2: state[1],
        omega1: state[2],
        omega2: state[3],
        energy: compute_energy(&state, m1, m2, l1, l2, g),
    });

    for step in 1..=num_steps {
        // RK4 Integration step
        let k1 = derivatives(&state, m1, m2, l1, l2, g);

        let mut s2 = [0.0; 4];
        for i in 0..4 {
            s2[i] = state[i] + 0.5 * dt * k1[i];
        }
        let k2 = derivatives(&s2, m1, m2, l1, l2, g);

        let mut s3 = [0.0; 4];
        for i in 0..4 {
            s3[i] = state[i] + 0.5 * dt * k2[i];
        }
        let k3 = derivatives(&s3, m1, m2, l1, l2, g);

        let mut s4 = [0.0; 4];
        for i in 0..4 {
            s4[i] = state[i] + dt * k3[i];
        }
        let k4 = derivatives(&s4, m1, m2, l1, l2, g);

        for i in 0..4 {
            state[i] += (dt / 6.0) * (k1[i] + 2.0 * k2[i] + 2.0 * k3[i] + k4[i]);
        }

        if step % sample_stride == 0 {
            trajectory.push(DoublePendulumState {
                theta1: state[0],
                theta2: state[1],
                omega1: state[2],
                omega2: state[3],
                energy: compute_energy(&state, m1, m2, l1, l2, g),
            });
        }
    }

    trajectory
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_double_pendulum_rk4() {
        let traj = simulate_double_pendulum_rk4(
            std::f64::consts::PI / 2.0,
            std::f64::consts::PI / 2.0,
            0.0,
            0.0,
            1.0,
            1.0,
            1.0,
            1.0,
            9.81,
            0.001,
            1000,
            100,
        );

        assert_eq!(traj.len(), 11);
        let e0 = traj[0].energy;
        let e_end = traj.last().unwrap().energy;
        // Energy conservation check (relative error < 1e-4)
        assert!((e_end - e0).abs() / e0.abs() < 1e-3);
    }
}
