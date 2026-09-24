//! N-Body gravitational dynamics simulator using Symplectic Velocity-Verlet.

#[derive(Clone, Debug, PartialEq)]
pub struct Body {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub vx: f64,
    pub vy: f64,
    pub vz: f64,
    pub mass: f64,
}

/// Compute gravitational accelerations for all N bodies.
fn compute_accelerations(bodies: &[Body], g: f64, softening: f64) -> (Vec<f64>, Vec<f64>, Vec<f64>) {
    let n = bodies.len();
    let mut ax = vec![0.0; n];
    let mut ay = vec![0.0; n];
    let mut az = vec![0.0; n];
    let eps_sq = softening * softening;

    for i in 0..n {
        let bi = &bodies[i];
        let mut axi = 0.0;
        let mut ayi = 0.0;
        let mut azi = 0.0;

        for j in 0..n {
            if i == j {
                continue;
            }
            let bj = &bodies[j];
            let dx = bj.x - bi.x;
            let dy = bj.y - bi.y;
            let dz = bj.z - bi.z;

            let dist_sq = dx * dx + dy * dy + dz * dz + eps_sq;
            let inv_dist3 = 1.0 / (dist_sq * dist_sq.sqrt());
            let factor = g * bj.mass * inv_dist3;

            axi += factor * dx;
            ayi += factor * dy;
            azi += factor * dz;
        }

        ax[i] = axi;
        ay[i] = ayi;
        az[i] = azi;
    }

    (ax, ay, az)
}

/// Simulates N gravitationally interacting bodies using Velocity Verlet integration.
/// Returns the final positions and velocities, as well as total energy (kinetic + potential).
pub fn simulate_nbody_gravity(
    mut bodies: Vec<Body>,
    dt: f64,
    num_steps: usize,
    g: f64,
    softening: f64,
) -> (Vec<Body>, f64) {
    if bodies.is_empty() || num_steps == 0 {
        return (bodies, 0.0);
    }

    let n = bodies.len();
    let (mut ax, mut ay, mut az) = compute_accelerations(&bodies, g, softening);

    for _ in 0..num_steps {
        // 1. Half step velocity + full step position
        for i in 0..n {
            let b = &mut bodies[i];
            b.vx += 0.5 * ax[i] * dt;
            b.vy += 0.5 * ay[i] * dt;
            b.vz += 0.5 * az[i] * dt;

            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.z += b.vz * dt;
        }

        // 2. New acceleration at new positions
        let (new_ax, new_ay, new_az) = compute_accelerations(&bodies, g, softening);
        ax = new_ax;
        ay = new_ay;
        az = new_az;

        // 3. Second half step velocity
        for i in 0..n {
            let b = &mut bodies[i];
            b.vx += 0.5 * ax[i] * dt;
            b.vy += 0.5 * ay[i] * dt;
            b.vz += 0.5 * az[i] * dt;
        }
    }

    // Compute total system energy (Kinetic + Potential)
    let mut kinetic = 0.0;
    let mut potential = 0.0;
    let eps_sq = softening * softening;

    for i in 0..n {
        let bi = &bodies[i];
        let v_sq = bi.vx * bi.vx + bi.vy * bi.vy + bi.vz * bi.vz;
        kinetic += 0.5 * bi.mass * v_sq;

        for j in (i + 1)..n {
            let bj = &bodies[j];
            let dx = bj.x - bi.x;
            let dy = bj.y - bi.y;
            let dz = bj.z - bi.z;
            let dist = (dx * dx + dy * dy + dz * dz + eps_sq).sqrt();
            potential -= (g * bi.mass * bj.mass) / dist;
        }
    }

    (bodies, kinetic + potential)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_two_body_orbit() {
        let bodies = vec![
            Body { x: 0.0, y: 0.0, z: 0.0, vx: 0.0, vy: 0.0, vz: 0.0, mass: 1000.0 },
            Body { x: 10.0, y: 0.0, z: 0.0, vx: 0.0, vy: 10.0, vz: 0.0, mass: 1.0 },
        ];

        let (final_bodies, energy) = simulate_nbody_gravity(bodies, 0.001, 1000, 1.0, 0.01);
        assert_eq!(final_bodies.len(), 2);
        assert!(energy.is_finite());
    }
}
