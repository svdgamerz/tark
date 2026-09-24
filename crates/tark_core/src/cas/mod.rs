//! Native Computer Algebra System (CAS) for Tark.
//! Provides symbolic differentiation, algebraic simplification, and equation solving with KaTeX derivations.

pub mod ast;
pub mod diff;
pub mod parser;
pub mod solver;

pub use ast::Expr;
pub use diff::{DerivationStep, Differentiator};
pub use parser::Parser;
pub use solver::{EquationSolution, SolutionStep, Solver};

/// Differentiate an expression string with respect to `var`
pub fn differentiate_expr(expr_str: &str, var: &str) -> Result<(String, String, Vec<(String, String, String)>), String> {
    let expr = Parser::parse(expr_str)?;
    let mut diff = Differentiator::new(var);
    let (deriv, steps) = diff.differentiate(&expr);

    let steps_tuples = steps
        .into_iter()
        .map(|s| (s.rule, s.explanation, s.latex))
        .collect();

    Ok((deriv.to_string(), deriv.to_katex(), steps_tuples))
}

/// Simplify an algebraic expression string
pub fn simplify_expr(expr_str: &str) -> Result<(String, String), String> {
    let expr = Parser::parse(expr_str)?;
    let simplified = expr.simplify();
    Ok((simplified.to_string(), simplified.to_katex()))
}

/// Solve an equation for `var`
pub fn solve_equation(eq_str: &str, var: &str) -> Result<(Vec<String>, Vec<(String, String, String)>), String> {
    let sol = Solver::solve(eq_str, var)?;
    let steps_tuples = sol
        .steps
        .into_iter()
        .map(|s| (s.title, s.explanation, s.latex))
        .collect();

    Ok((sol.roots, steps_tuples))
}
