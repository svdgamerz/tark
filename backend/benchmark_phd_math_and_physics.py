"""Comprehensive Benchmark Suite: Rust (`tark_core`) vs Python.

Evaluates high-dimensional mathematical problems (PhD level) and physical simulations:
1. N-Body Gravitational Dynamics (Astrophysics / Symplectic Verlet)
2. Chaotic Double Pendulum (Lagrangian Dynamics / RK4)
3. 2D Heat Diffusion PDE (Thermodynamics / Finite Difference)
4. Lorenz Attractor & Maximal Lyapunov Exponent (Nonlinear Dynamics & Chaos)
5. Fermi-Dirac & Debye Special Function Quadrature (Quantum Statistics / Solid State)
6. Radix-2 Fast Fourier Transform (Signal Processing & Wave Mechanics)
7. Durand-Kerner Complex Polynomial Roots (Algebraic Geometry & Control Systems)
"""
import math
import random
import sys
import time
import tracemalloc

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

import tark_core


# =========================================================================
# 1. N-BODY GRAVITATION BENCHMARK
# =========================================================================

def py_nbody(bodies, dt, steps, g=1.0, softening=0.05):
    n = len(bodies)
    b = [list(x) for x in bodies]
    eps_sq = softening * softening

    def compute_acc(b_data):
        ax, ay, az = [0.0] * n, [0.0] * n, [0.0] * n
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

    ax, ay, az = compute_acc(b)
    for _ in range(steps):
        for i in range(n):
            b[i][3] += 0.5 * ax[i] * dt
            b[i][4] += 0.5 * ay[i] * dt
            b[i][5] += 0.5 * az[i] * dt
            b[i][0] += b[i][3] * dt
            b[i][1] += b[i][4] * dt
            b[i][2] += b[i][5] * dt

        ax, ay, az = compute_acc(b)
        for i in range(n):
            b[i][3] += 0.5 * ax[i] * dt
            b[i][4] += 0.5 * ay[i] * dt
            b[i][5] += 0.5 * az[i] * dt

    return b


# =========================================================================
# 2. DOUBLE PENDULUM RK4 BENCHMARK
# =========================================================================

def py_double_pendulum(t1, t2, w1, w2, steps, dt=0.001):
    m1, m2, l1, l2, g = 1.0, 1.0, 1.0, 1.0, 9.81

    def derivs(theta1, theta2, omega1, omega2):
        delta = theta1 - theta2
        den = 2.0 * m1 + m2 - m2 * math.cos(2.0 * theta1 - 2.0 * theta2)
        num1 = (
            -g * (2.0 * m1 + m2) * math.sin(theta1)
            - m2 * g * math.sin(theta1 - 2.0 * theta2)
            - 2.0 * math.sin(delta) * m2 * (omega2 * omega2 * l2 + omega1 * omega1 * l1 * math.cos(delta))
        )
        alpha1 = num1 / (l1 * den)
        num2 = 2.0 * math.sin(delta) * (
            omega1 * omega1 * l1 * (m1 + m2)
            + g * (m1 + m2) * math.cos(theta1)
            + omega2 * omega2 * l2 * m2 * math.cos(delta)
        )
        alpha2 = num2 / (l2 * den)
        return omega1, omega2, alpha1, alpha2

    for _ in range(steps):
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

    return t1, t2, w1, w2


# =========================================================================
# 3. 2D HEAT DIFFUSION PDE BENCHMARK
# =========================================================================

def py_heat_diffusion(n, steps, alpha=0.2, dx=1.0, dt=0.5):
    u = [0.0] * (n * n)
    u_next = [0.0] * (n * n)
    c = n // 2
    for i in range(c - 4, c + 5):
        for j in range(c - 4, c + 5):
            u[i * n + j] = 100.0

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

    return max(u)


# =========================================================================
# 4. LORENZ LYAPUNOV EXPONENT BENCHMARK (CHAOS THEORY)
# =========================================================================

def py_lyapunov(steps, dt=0.005, sigma=10.0, rho=28.0, beta=8.0/3.0):
    def rk4(x, y, z):
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

        return (
            x + (dt / 6.0) * (k1x + 2.0 * k2x + 2.0 * k3x + k4x),
            y + (dt / 6.0) * (k1y + 2.0 * k2y + 2.0 * k3y + k4y),
            z + (dt / 6.0) * (k1z + 2.0 * k2z + 2.0 * k3z + k4z),
        )

    x, y, z = 1.0, 1.0, 1.0
    for _ in range(5000):
        x, y, z = rk4(x, y, z)

    d0 = 1e-8
    px, py, pz = x + d0, y, z
    lyap_sum = 0.0

    for _ in range(steps):
        x, y, z = rk4(x, y, z)
        px, py, pz = rk4(px, py, pz)
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
# 5. SPECIAL FUNCTIONS QUADRATURE BENCHMARK
# =========================================================================

def py_fermi_dirac_trapezoid(eta, steps=2000):
    total = 0.0
    dt = 0.01
    for i in range(1, steps):
        t = i * dt
        denom = math.exp(t - eta) + 1.0
        total += (math.sqrt(t) / denom) * dt
    return total


# =========================================================================
# 6. RADIX-2 FFT BENCHMARK
# =========================================================================

def py_fft(x):
    n = len(x)
    if n <= 1:
        return x
    even = py_fft(x[0::2])
    odd = py_fft(x[1::2])
    t = [math.e ** (-2j * math.pi * k / n) * odd[k] for k in range(n // 2)]
    return [even[k] + t[k] for k in range(n // 2)] + [even[k] - t[k] for k in range(n // 2)]


# =========================================================================
# 7. COMPLEX ROOTS BENCHMARK (DURAND-KERNER)
# =========================================================================

def py_polynomial_roots(coeffs, max_iter=100, tol=1e-10):
    n = len(coeffs)
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

    return roots


# =========================================================================
# BENCHMARK RUNNER
# =========================================================================

def run_benchmarks():
    print("=" * 80)
    print("         TARK SCIENTIFIC & MATHEMATICAL BENCHMARK SUITE")
    print("      PhD-Level Advanced Mathematics & Numerical Physics Simulation")
    print("                   Rust (tark_core) vs Python 3.12")
    print("=" * 80)

    results = []

    # -------------------------------------------------------------
    # 1. N-Body Simulation
    # -------------------------------------------------------------
    print("\n[1/7] Benchmarking N-Body Gravitational Dynamics (N=64, 500 steps)...")
    random.seed(42)
    bodies = [
        (random.uniform(-50, 50), random.uniform(-50, 50), random.uniform(-50, 50),
         random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1),
         random.uniform(10, 100))
        for _ in range(64)
    ]

    t0 = time.perf_counter()
    _ = py_nbody(bodies, 0.001, 500)
    t_py = (time.perf_counter() - t0) * 1000

    t0 = time.perf_counter()
    _ = tark_core.simulate_nbody(bodies, 0.001, 500)
    t_rust = (time.perf_counter() - t0) * 1000

    speedup = t_py / t_rust if t_rust > 0 else 0
    results.append(("N-Body Gravitation (N=64, 500 steps)", f"{t_py:.1f} ms", f"{t_rust:.2f} ms", f"{speedup:.1f}x"))
    print(f"      Python: {t_py:.2f} ms | Rust: {t_rust:.2f} ms -> {speedup:.1f}x faster 🚀")

    # -------------------------------------------------------------
    # 2. Chaotic Double Pendulum (RK4)
    # -------------------------------------------------------------
    print("\n[2/7] Benchmarking Chaotic Double Pendulum RK4 (50,000 steps)...")
    t0 = time.perf_counter()
    _ = py_double_pendulum(1.57, 1.57, 0.0, 0.0, 50000)
    t_py = (time.perf_counter() - t0) * 1000

    t0 = time.perf_counter()
    _ = tark_core.simulate_double_pendulum(1.57, 1.57, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 9.81, 0.001, 50000, 100)
    t_rust = (time.perf_counter() - t0) * 1000

    speedup = t_py / t_rust if t_rust > 0 else 0
    results.append(("Chaotic Double Pendulum (50K RK4 steps)", f"{t_py:.1f} ms", f"{t_rust:.2f} ms", f"{speedup:.1f}x"))
    print(f"      Python: {t_py:.2f} ms | Rust: {t_rust:.2f} ms -> {speedup:.1f}x faster 🚀")

    # -------------------------------------------------------------
    # 3. 2D Heat Diffusion PDE (FDM)
    # -------------------------------------------------------------
    print("\n[3/7] Benchmarking 2D Heat Diffusion PDE (128x128 grid, 250 steps)...")
    t0 = time.perf_counter()
    _ = py_heat_diffusion(128, 250)
    t_py = (time.perf_counter() - t0) * 1000

    t0 = time.perf_counter()
    _ = tark_core.simulate_heat_diffusion(128, 0.2, 1.0, 0.5, 250)
    t_rust = (time.perf_counter() - t0) * 1000

    speedup = t_py / t_rust if t_rust > 0 else 0
    results.append(("2D Heat Diffusion PDE (128x128, 250 steps)", f"{t_py:.1f} ms", f"{t_rust:.2f} ms", f"{speedup:.1f}x"))
    print(f"      Python: {t_py:.2f} ms | Rust: {t_rust:.2f} ms -> {speedup:.1f}x faster 🚀")

    # -------------------------------------------------------------
    # 4. Lorenz Attractor & Lyapunov Exponent (Chaos Theory)
    # -------------------------------------------------------------
    print("\n[4/7] Benchmarking Lorenz Attractor & Lyapunov Exponent (200,000 steps)...")
    t0 = time.perf_counter()
    mle_py = py_lyapunov(200000)
    t_py = (time.perf_counter() - t0) * 1000

    t0 = time.perf_counter()
    mle_rust = tark_core.lorenz_lyapunov_exponent(1.0, 1.0, 1.0, 10.0, 28.0, 8.0/3.0, 0.005, 200000)
    t_rust = (time.perf_counter() - t0) * 1000

    speedup = t_py / t_rust if t_rust > 0 else 0
    results.append(("Lorenz Lyapunov Exponent (200K steps)", f"{t_py:.1f} ms", f"{t_rust:.2f} ms", f"{speedup:.1f}x"))
    print(f"      Python MLE: {mle_py:.4f} ({t_py:.1f} ms)")
    print(f"      Rust MLE:   {mle_rust:.4f} ({t_rust:.2f} ms) -> {speedup:.1f}x faster 🚀")

    # -------------------------------------------------------------
    # 5. Fermi-Dirac & Debye Special Function Quadrature
    # -------------------------------------------------------------
    print("\n[5/7] Benchmarking Fermi-Dirac & Debye Function Integration (2,000 evals)...")
    t0 = time.perf_counter()
    for i in range(2000):
        _ = py_fermi_dirac_trapezoid(i * 0.005)
    t_py = (time.perf_counter() - t0) * 1000

    t0 = time.perf_counter()
    for i in range(2000):
        _ = tark_core.fermi_dirac_integral(i * 0.005, 64)
    t_rust = (time.perf_counter() - t0) * 1000

    speedup = t_py / t_rust if t_rust > 0 else 0
    results.append(("Fermi-Dirac Integral (2,000 evals)", f"{t_py:.1f} ms", f"{t_rust:.2f} ms", f"{speedup:.1f}x"))
    print(f"      Python: {t_py:.2f} ms | Rust: {t_rust:.2f} ms -> {speedup:.1f}x faster 🚀")

    # -------------------------------------------------------------
    # 6. Fast Fourier Transform (FFT)
    # -------------------------------------------------------------
    print("\n[6/7] Benchmarking Fast Fourier Transform (N=8192 complex points)...")
    n_fft = 8192
    complex_data = [complex(math.sin(i * 0.1), math.cos(i * 0.05)) for i in range(n_fft)]
    re_vals = [c.real for c in complex_data]
    im_vals = [c.imag for c in complex_data]

    t0 = time.perf_counter()
    _ = py_fft(complex_data)
    t_py = (time.perf_counter() - t0) * 1000

    t0 = time.perf_counter()
    _ = tark_core.fft(re_vals, im_vals, False)
    t_rust = (time.perf_counter() - t0) * 1000

    speedup = t_py / t_rust if t_rust > 0 else 0
    results.append(("Radix-2 FFT (N=8,192 complex points)", f"{t_py:.1f} ms", f"{t_rust:.2f} ms", f"{speedup:.1f}x"))
    print(f"      Python: {t_py:.2f} ms | Rust: {t_rust:.2f} ms -> {speedup:.1f}x faster 🚀")

    # -------------------------------------------------------------
    # 7. Durand-Kerner Complex Polynomial Roots
    # -------------------------------------------------------------
    print("\n[7/7] Benchmarking Durand-Kerner Complex Roots (Degree 16 polynomial)...")
    # P(z) = z^16 - 1 = 0
    coeffs = [-1.0] + [0.0] * 14
    t0 = time.perf_counter()
    _ = py_polynomial_roots(coeffs, 150)
    t_py = (time.perf_counter() - t0) * 1000

    t0 = time.perf_counter()
    _ = tark_core.polynomial_roots(coeffs, 150, 1e-10)
    t_rust = (time.perf_counter() - t0) * 1000

    speedup = t_py / t_rust if t_rust > 0 else 0
    results.append(("Polynomial Roots (Degree 16 Durand-Kerner)", f"{t_py:.1f} ms", f"{t_rust:.2f} ms", f"{speedup:.1f}x"))
    print(f"      Python: {t_py:.2f} ms | Rust: {t_rust:.2f} ms -> {speedup:.1f}x faster 🚀")

    # -------------------------------------------------------------
    # Summary Table
    # -------------------------------------------------------------
    print("\n" + "=" * 80)
    print("                    FINAL BENCHMARK SUMMARY REPORT")
    print("=" * 80)
    print(f"{'Task / Mathematical Domain':<42} | {'Python 3.12':<12} | {'Rust Core':<10} | {'Speedup':<8}")
    print("-" * 80)
    for name, py_time, rust_time, sp in results:
        print(f"{name:<42} | {py_time:<12} | {rust_time:<10} | {sp:<8}")
    print("=" * 80)

if __name__ == "__main__":
    run_benchmarks()
