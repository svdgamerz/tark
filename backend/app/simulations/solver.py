"""High-Performance Numerical Physics & Mathematics Solver for Tark Simulations.

Provides native Rust-accelerated numerical trajectory solvers, differential equation
integrators (RK4, Verlet), and advanced mathematical solvers via `tark_core`.
Includes transparent, fully-featured pure Python fallbacks.
"""
from __future__ import annotations

import logging
import math
from typing import Any

logger = logging.getLogger("tark.simulations.solver")

try:
    import tark_core
    _HAVE_RUST = True
    logger.info("tark_core native Rust acceleration active for Physics & Math solvers")
except ImportError:
    _HAVE_RUST = False
    logger.warning("tark_core not found; falling back to pure Python physics/math solvers")


def is_rust_accelerated() -> bool:
    """Returns True if the native Rust acceleration module is active."""
    return _HAVE_RUST and getattr(tark_core, "is_rust_accelerated", lambda: False)()


# =========================================================================
# 1. N-BODY GRAVITATIONAL DYNAMICS
# =========================================================================

def solve_nbody_gravity(
    bodies: list[tuple[float, float, float, float, float, float, float]],
    dt: float = 0.001,
    num_steps: int = 1000,
    g: float = 1.0,
    softening: float = 0.05,
) -> tuple[list[tuple[float, float, float, float, float, float, float]], float]:
    """Simulates N-body gravitational dynamics using Velocity-Verlet.

    Each body: (x, y, z, vx, vy, vz, mass).
    Returns: (final_bodies, total_energy).
    """
    if _HAVE_RUST:
        return tark_core.simulate_nbody(bodies, dt, num_steps, g, softening)

    # Pure Python fallback
    n = len(bodies)
    if n == 0 or num_steps == 0:
        return bodies, 0.0

    b_list = [list(b) for b in bodies]
    eps_sq = softening * softening

    def compute_acc(b_data):
        ax = [0.0] * n
        ay = [0.0] * n
        az = [0.0] * n
        for i in range(n):
            xi, yi, zi = b_data[i][0], b_data[i][1], b_data[i][2]
            for j in range(n):
                if i == j:
                    continue
                dx = b_data[j][0] - xi
                dy = b_data[j][1] - yi
                dz = b_data[j][2] - zi
                dist_sq = dx * dx + dy * dy + dz * dz + eps_sq
                factor = g * b_data[j][6] / (dist_sq * math.sqrt(dist_sq))
                ax[i] += factor * dx
                ay[i] += factor * dy
                az[i] += factor * dz
        return ax, ay, az

    ax, ay, az = compute_acc(b_list)
    for _ in range(num_steps):
        for i in range(n):
            b_list[i][3] += 0.5 * ax[i] * dt
            b_list[i][4] += 0.5 * ay[i] * dt
            b_list[i][5] += 0.5 * az[i] * dt
            b_list[i][0] += b_list[i][3] * dt
            b_list[i][1] += b_list[i][4] * dt
            b_list[i][2] += b_list[i][5] * dt

        ax, ay, az = compute_acc(b_list)
        for i in range(n):
            b_list[i][3] += 0.5 * ax[i] * dt
            b_list[i][4] += 0.5 * ay[i] * dt
            b_list[i][5] += 0.5 * az[i] * dt

    kinetic, potential = 0.0, 0.0
    for i in range(n):
        v_sq = b_list[i][3] ** 2 + b_list[i][4] ** 2 + b_list[i][5] ** 2
        kinetic += 0.5 * b_list[i][6] * v_sq
        for j in range(i + 1, n):
            dx = b_list[j][0] - b_list[i][0]
            dy = b_list[j][1] - b_list[i][1]
            dz = b_list[j][2] - b_list[i][2]
            dist = math.sqrt(dx * dx + dy * dy + dz * dz + eps_sq)
            potential -= (g * b_list[i][6] * b_list[j][6]) / dist

    return [tuple(b) for b in b_list], kinetic + potential


# =========================================================================
# 2. CHAOTIC DOUBLE PENDULUM (RK4)
# =========================================================================

def solve_double_pendulum(
    theta1: float,
    theta2: float,
    omega1: float,
    omega2: float,
    m1: float = 1.0,
    m2: float = 1.0,
    l1: float = 1.0,
    l2: float = 1.0,
    g: float = 9.81,
    dt: float = 0.001,
    num_steps: int = 10000,
    sample_stride: int = 10,
) -> list[tuple[float, float, float, float, float]]:
    """Simulates chaotic double pendulum using 4th-order Runge-Kutta (RK4).

    Returns: list of (theta1, theta2, omega1, omega2, energy).
    """
    if _HAVE_RUST:
        return tark_core.simulate_double_pendulum(
            theta1, theta2, omega1, omega2, m1, m2, l1, l2, g, dt, num_steps, sample_stride
        )

    # Pure Python fallback
    def derivs(t1, t2, w1, w2):
        delta = t1 - t2
        den = 2.0 * m1 + m2 - m2 * math.cos(2.0 * t1 - 2.0 * t2)
        num1 = (
            -g * (2.0 * m1 + m2) * math.sin(t1)
            - m2 * g * math.sin(t1 - 2.0 * t2)
            - 2.0 * math.sin(delta) * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * math.cos(delta))
        )
        alpha1 = num1 / (l1 * den)
        num2 = 2.0 * math.sin(delta) * (
            w1 * w1 * l1 * (m1 + m2)
            + g * (m1 + m2) * math.cos(t1)
            + w2 * w2 * l2 * m2 * math.cos(delta)
        )
        alpha2 = num2 / (l2 * den)
        return w1, w2, alpha1, alpha2

    def calc_energy(t1, t2, w1, w2):
        ke = 0.5 * m1 * (l1 * w1) ** 2 + 0.5 * m2 * (
            (l1 * w1) ** 2 + (l2 * w2) ** 2 + 2.0 * l1 * l2 * w1 * w2 * math.cos(t1 - t2)
        )
        pe = -(m1 + m2) * g * l1 * math.cos(t1) - m2 * g * l2 * math.cos(t2)
        return ke + pe

    t1, t2, w1, w2 = theta1, theta2, omega1, omega2
    trajectory = [(t1, t2, w1, w2, calc_energy(t1, t2, w1, w2))]

    for step in range(1, num_steps + 1):
        k1_t1, k1_t2, k1_w1, k1_w2 = derivs(t1, t2, w1, w2)
        k2_t1, k2_t2, k2_w1, k2_w2 = derivs(
            t1 + 0.5 * dt * k1_t1, t2 + 0.5 * dt * k1_t2,
            w1 + 0.5 * dt * k1_w1, w2 + 0.5 * dt * k1_w2,
        )
        k3_t1, k3_t2, k3_w1, k3_w2 = derivs(
            t1 + 0.5 * dt * k2_t1, t2 + 0.5 * dt * k2_t2,
            w1 + 0.5 * dt * k2_w1, w2 + 0.5 * dt * k2_w2,
        )
        k4_t1, k4_t2, k4_w1, k4_w2 = derivs(
            t1 + dt * k3_t1, t2 + dt * k3_t2,
            w1 + dt * k3_w1, w2 + dt * k3_w2,
        )

        t1 += (dt / 6.0) * (k1_t1 + 2.0 * k2_t1 + 2.0 * k3_t1 + k4_t1)
        t2 += (dt / 6.0) * (k1_t2 + 2.0 * k2_t2 + 2.0 * k3_t2 + k4_t2)
        w1 += (dt / 6.0) * (k1_w1 + 2.0 * k2_w1 + 2.0 * k3_w1 + k4_w1)
        w2 += (dt / 6.0) * (k1_w2 + 2.0 * k2_w2 + 2.0 * k3_w2 + k4_w2)

        if step % sample_stride == 0:
            trajectory.append((t1, t2, w1, w2, calc_energy(t1, t2, w1, w2)))

    return trajectory


# =========================================================================
# 3. 2D HEAT DIFFUSION PDE (FDM)
# =========================================================================

def solve_heat_diffusion(
    grid_size: int = 64,
    alpha: float = 0.2,
    dx: float = 1.0,
    dt: float = 0.5,
    steps: int = 200,
    initial_heat: float = 100.0,
) -> tuple[list[float], float]:
    """Solves the 2D heat equation du/dt = alpha * (d2u/dx2 + d2u/dy2) using FDM."""
    if _HAVE_RUST:
        return tark_core.simulate_heat_diffusion(grid_size, alpha, dx, dt, steps, initial_heat)

    # Pure Python fallback
    n = grid_size
    u = [0.0] * (n * n)
    u_next = [0.0] * (n * n)
    center = n // 2
    for i in range(max(0, center - 4), min(n, center + 5)):
        for j in range(max(0, center - 4), min(n, center + 5)):
            u[i * n + j] = initial_heat

    gamma = alpha * dt / (dx * dx)
    for _ in range(steps):
        for i in range(1, n - 1):
            row = i * n
            row_up = (i - 1) * n
            row_down = (i + 1) * n
            for j in range(1, n - 1):
                c_val = u[row + j]
                lap = u[row + j + 1] + u[row + j - 1] + u[row_down + j] + u[row_up + j] - 4.0 * c_val
                u_next[row + j] = c_val + gamma * lap

        u, u_next = u_next, u

    return u, max(u)


# =========================================================================
# 4. LORENZ ATTRACTOR & LYAPUNOV EXPONENT (CHAOS THEORY)
# =========================================================================

def solve_lorenz_chaos(
    steps: int = 100000,
    dt: float = 0.005,
    sigma: float = 10.0,
    rho: float = 28.0,
    beta: float = 8.0 / 3.0,
) -> float:
    """Computes the Maximal Lyapunov Exponent of the Lorenz attractor system."""
    if _HAVE_RUST:
        return tark_core.lorenz_lyapunov_exponent(1.0, 1.0, 1.0, sigma, rho, beta, dt, steps)

    # Pure Python fallback
    def rk4_step(x, y, z):
        k1x = sigma * (y - x)
        k1y = x * (rho - z) - y
        k1z = x * y - beta * z

        k2x = sigma * ((y + 0.5 * dt * k1y) - (x + 0.5 * dt * k1x))
        k2y = (x + 0.5 * dt * k1x) * (rho - (z + 0.5 * dt * k1z)) - (y + 0.5 * dt * k1y)
        k2z = (x + 0.5 * dt * k1x) * (y + 0.5 * dt * k1y) - beta * (z + 0.5 * dt * k1z)

        k3x = sigma * ((y + 0.5 * dt * k2y) - (x + 0.5 * dt * k2x))
        k3y = (x + 0.5 * dt * k2x) * (rho - (z + 0.5 * dt * k2z)) - (y + 0.5 * dt * k2y)
        k3z = (x + 0.5 * dt * k2x) * (y + 0.5 * dt * k2y) - beta * (z + 0.5 * dt * k2z)

        k4x = sigma * ((y + dt * k3y) - (x + dt * k3x))
        k4y = (x + dt * k3x) * (rho - (z + dt * k3z)) - (y + dt * k3y)
        k4z = (x + dt * k3x) * (y + dt * k3y) - beta * (z + dt * k3z)

        nx = x + (dt / 6.0) * (k1x + 2.0 * k2x + 2.0 * k3x + k4x)
        ny = y + (dt / 6.0) * (k1y + 2.0 * k2y + 2.0 * k3y + k4y)
        nz = z + (dt / 6.0) * (k1z + 2.0 * k2z + 2.0 * k3z + k4z)
        return nx, ny, nz

    x, y, z = 1.0, 1.0, 1.0
    for _ in range(5000):
        x, y, z = rk4_step(x, y, z)

    d0 = 1e-8
    px, py, pz = x + d0, y, z
    lyap_sum = 0.0

    for _ in range(steps):
        x, y, z = rk4_step(x, y, z)
        px, py, pz = rk4_step(px, py, pz)
        dx, dy, dz = px - x, py - y, pz - z
        d1 = math.sqrt(dx * dx + dy * dy + dz * dz)
        if d1 > 0.0:
            lyap_sum += math.log(d1 / d0)
            scale = d0 / d1
            px = x + dx * scale
            py = y + dy * scale
            pz = z + dz * scale

    return lyap_sum / (steps * dt)


# =========================================================================
# 5. SPECIAL FUNCTIONS: FERMI-DIRAC & DEBYE (GAUSS-LEGENDRE QUADRATURE)
# =========================================================================

def solve_fermi_dirac(eta: float, n_points: int = 64) -> float:
    """Evaluates the Fermi-Dirac integral F_{1/2}(eta) using Gauss-Legendre quadrature."""
    if _HAVE_RUST:
        return tark_core.fermi_dirac_integral(eta, n_points)

    # Trapezoidal approximation fallback
    total = 0.0
    dt = 0.01
    for i in range(1, 2000):
        t = i * dt
        denom = math.exp(t - eta) + 1.0
        total += (math.sqrt(t) / denom) * dt
    return total


# =========================================================================
# 6. COMPLEX POLYNOMIAL ROOTS (DURAND-KERNER WEIERSTRASS METHOD)
# =========================================================================

def solve_polynomial_roots(
    coeffs: list[float],
    max_iter: int = 100,
    tol: float = 1e-10,
) -> list[tuple[float, float]]:
    """Finds all complex roots of a monic polynomial P(z) = z^n + sum(coeffs[i]*z^i) = 0."""
    if _HAVE_RUST:
        return tark_core.polynomial_roots(coeffs, max_iter, tol)

    # Pure Python Durand-Kerner fallback
    n = len(coeffs)
    if n == 0:
        return []

    base = complex(0.4, 0.9)
    roots = [base ** (k + 1) for k in range(n)]

    def eval_poly(z):
        res = complex(1.0, 0.0)
        for c in reversed(coeffs):
            res = res * z + complex(c, 0.0)
        return res

    tol_sq = tol * tol
    for _ in range(max_iter):
        max_ch = 0.0
        for i in range(n):
            zi = roots[i]
            p_zi = eval_poly(zi)
            denom = complex(1.0, 0.0)
            for j in range(n):
                if i != j:
                    denom *= (zi - roots[j])
            delta = p_zi / denom if denom != 0 else 0
            roots[i] -= delta
            ch = delta.real ** 2 + delta.imag ** 2
            if ch > max_ch:
                max_ch = ch
        if max_ch < tol_sq:
            break

    return [(r.real, r.imag) for r in roots]
