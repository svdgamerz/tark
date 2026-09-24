//! Analytical and Polynomial Equation Solver with Pedagogical Derivations.

use crate::cas::ast::Expr;
use crate::cas::parser::Parser;

#[derive(Debug, Clone)]
pub struct SolutionStep {
    pub title: String,
    pub latex: String,
    pub explanation: String,
}

#[derive(Debug, Clone)]
pub struct EquationSolution {
    pub roots: Vec<String>,
    pub steps: Vec<SolutionStep>,
}

pub struct Solver;

impl Solver {
    /// Solve an equation of form "LHS = RHS" or "f(x)" (implied "= 0") for variable `var`
    pub fn solve(equation: &str, var: &str) -> Result<EquationSolution, String> {
        let (lhs_str, rhs_str) = if let Some((l, r)) = equation.split_once('=') {
            (l.trim(), r.trim())
        } else {
            (equation.trim(), "0")
        };

        let lhs = Parser::parse(lhs_str)?;
        let rhs = Parser::parse(rhs_str)?;
        let mut steps = Vec::new();

        steps.push(SolutionStep {
            title: "Original Equation".to_string(),
            latex: format!("{} = {}", lhs.to_katex(), rhs.to_katex()),
            explanation: format!("Given equation to solve for variable '{}'", var),
        });

        // Form f(x) = LHS - RHS = 0
        let zero_form = Expr::add(lhs, Expr::neg(rhs)).simplify();
        steps.push(SolutionStep {
            title: "Standard Form f(x) = 0".to_string(),
            latex: format!("{} = 0", zero_form.to_katex()),
            explanation: "Rearrange all terms to the left-hand side so the equation equals 0.".to_string(),
        });

        // Try extracting polynomial coefficients: a*x^2 + b*x + c
        if let Some((a, b, c)) = extract_quadratic_coeffs(&zero_form, var) {
            if a.abs() > 1e-12 {
                // Quadratic Equation: ax^2 + bx + c = 0
                return solve_quadratic(a, b, c, var, steps);
            } else if b.abs() > 1e-12 {
                // Linear Equation: bx + c = 0 -> x = -c/b
                let root = -c / b;
                steps.push(SolutionStep {
                    title: "Linear Isolation".to_string(),
                    latex: format!("{} \\cdot {} + ({}) = 0 \\implies {} = -\\frac{{{}}}{{{}}} = {:.4}",
                        b, var, c, var, c, b, root),
                    explanation: format!("Isolate the linear variable {}.", var),
                });
                return Ok(EquationSolution {
                    roots: vec![format!("{:.4}", root)],
                    steps,
                });
            } else {
                return Err("Equation has no variable dependence.".to_string());
            }
        }

        Err("General nonlinear solver requires numerical solver (use Durand-Kerner).".to_string())
    }
}

fn solve_quadratic(a: f64, b: f64, c: f64, var: &str, mut steps: Vec<SolutionStep>) -> Result<EquationSolution, String> {
    let disc = b * b - 4.0 * a * c;

    steps.push(SolutionStep {
        title: "Identify Coefficients".to_string(),
        latex: format!("a = {}, \\quad b = {}, \\quad c = {}", a, b, c),
        explanation: format!("Comparing with standard quadratic form a{}^2 + b{} + c = 0", var, var),
    });

    steps.push(SolutionStep {
        title: "Calculate Discriminant (Δ)".to_string(),
        latex: format!("\\Delta = b^2 - 4ac = ({})^2 - 4({})({}) = {:.4}", b, a, c, disc),
        explanation: if disc > 0.0 {
            "Discriminant is strictly positive (Δ > 0): Two distinct real roots.".to_string()
        } else if disc.abs() < 1e-12 {
            "Discriminant is zero (Δ = 0): One repeated real root.".to_string()
        } else {
            "Discriminant is negative (Δ < 0): Two complex conjugate roots.".to_string()
        },
    });

    steps.push(SolutionStep {
        title: "Quadratic Formula".to_string(),
        latex: format!("{} = \\frac{{-b \\pm \\sqrt{{\\Delta}}}}{{2a}} = \\frac{{-({}) \\pm \\sqrt{{{:.4}}}}}{{2({})}}", var, b, disc, a),
        explanation: "Apply the quadratic formula to obtain the exact solutions.".to_string(),
    });

    let mut roots = Vec::new();
    if disc >= 0.0 {
        let sqrt_d = disc.sqrt();
        let r1 = (-b + sqrt_d) / (2.0 * a);
        let r2 = (-b - sqrt_d) / (2.0 * a);

        roots.push(format!("{:.4}", r1));
        if (r1 - r2).abs() > 1e-12 {
            roots.push(format!("{:.4}", r2));
        }

        steps.push(SolutionStep {
            title: "Real Roots".to_string(),
            latex: if roots.len() == 2 {
                format!("{}_1 = {:.4}, \\quad {}_2 = {:.4}", var, r1, var, r2)
            } else {
                format!("{} = {:.4}", var, r1)
            },
            explanation: "Simplified real solutions to the quadratic equation.".to_string(),
        });
    } else {
        let real_part = -b / (2.0 * a);
        let imag_part = (-disc).sqrt() / (2.0 * a);

        let r1_str = format!("{:.4} + {:.4}i", real_part, imag_part);
        let r2_str = format!("{:.4} - {:.4}i", real_part, imag_part);
        roots.push(r1_str.clone());
        roots.push(r2_str.clone());

        steps.push(SolutionStep {
            title: "Complex Conjugate Roots".to_string(),
            latex: format!("{}_{{1,2}} = {:.4} \\pm {:.4}i", var, real_part, imag_part),
            explanation: "The roots contain imaginary components on the complex plane.".to_string(),
        });
    }

    Ok(EquationSolution { roots, steps })
}

/// Helper to extract (a, b, c) from a simplified polynomial Expr: a*x^2 + b*x + c
fn extract_quadratic_coeffs(expr: &Expr, var: &str) -> Option<(f64, f64, f64)> {
    let mut a = 0.0;
    let mut b = 0.0;
    let mut c = 0.0;

    let terms = match expr {
        Expr::Add(ts) => ts.clone(),
        other => vec![other.clone()],
    };

    for term in terms {
        let (sign, core) = match &term {
            Expr::Neg(inner) => (-1.0, inner.as_ref()),
            other => (1.0, other),
        };

        match core {
            Expr::Num(n) => c += sign * n,
            Expr::Var(v) if v == var => b += sign * 1.0,
            Expr::Pow(base, exp) => {
                if let (Expr::Var(v), Expr::Num(n)) = (base.as_ref(), exp.as_ref()) {
                    if v == var && (*n - 2.0).abs() < 1e-12 {
                        a += sign * 1.0;
                    } else if v == var && (*n - 1.0).abs() < 1e-12 {
                        b += sign * 1.0;
                    } else {
                        return None;
                    }
                } else {
                    return None;
                }
            }
            Expr::Mul(factors) => {
                let mut coeff = sign;
                let mut power = 0;

                for f in factors {
                    match f {
                        Expr::Num(n) => coeff *= n,
                        Expr::Var(v) if v == var => power += 1,
                        Expr::Pow(base, exp) => {
                            if let (Expr::Var(v), Expr::Num(n)) = (base.as_ref(), exp.as_ref()) {
                                if v == var {
                                    power += *n as i32;
                                } else {
                                    return None;
                                }
                            } else {
                                return None;
                            }
                        }
                        _ => return None,
                    }
                }

                match power {
                    0 => c += coeff,
                    1 => b += coeff,
                    2 => a += coeff,
                    _ => return None,
                }
            }
            _ => return None,
        }
    }

    Some((a, b, c))
}
