//! High-throughput parallel homework and exam grading engine for Tark.
//!
//! Evaluates student submissions across numeric tolerances, symbolic algebraic equivalence,
//! and step derivations using multi-core thread parallelism.

use crate::cas::parser::Parser;
use crate::cas::ast::Expr;
use std::thread;

#[derive(Clone, Debug, PartialEq)]
pub enum QuestionType {
    Numeric { tolerance: f64 },
    Symbolic,
    ExactMatch,
}

#[derive(Clone, Debug)]
pub struct Submission {
    pub student_id: String,
    pub question_id: String,
    pub student_answer: String,
    pub expected_answer: String,
    pub question_type: QuestionType,
}

#[derive(Clone, Debug)]
pub struct GradeResult {
    pub student_id: String,
    pub question_id: String,
    pub is_correct: bool,
    pub score: f64,
    pub feedback: String,
}

#[derive(Clone, Debug)]
pub struct BatchGradingSummary {
    pub total_submissions: usize,
    pub passed_count: usize,
    pub pass_rate: f64,
    pub average_score: f64,
    pub elapsed_micros: f64,
    pub throughput_per_sec: f64,
    pub results: Vec<GradeResult>,
}

/// Evaluate a single student submission
pub fn grade_submission(sub: &Submission) -> GradeResult {
    match &sub.question_type {
        QuestionType::Numeric { tolerance } => {
            let s_val = sub.student_answer.trim().parse::<f64>();
            let e_val = sub.expected_answer.trim().parse::<f64>();

            match (s_val, e_val) {
                (Ok(s), Ok(e)) => {
                    let diff = (s - e).abs();
                    let rel_diff = if e.abs() > 1e-12 { diff / e.abs() } else { diff };
                    let tol = *tolerance;

                    if diff <= tol || rel_diff <= tol {
                        GradeResult {
                            student_id: sub.student_id.clone(),
                            question_id: sub.question_id.clone(),
                            is_correct: true,
                            score: 1.0,
                            feedback: format!("Correct! Value matches target within tolerance ({:.4})", tol),
                        }
                    } else {
                        GradeResult {
                            student_id: sub.student_id.clone(),
                            question_id: sub.question_id.clone(),
                            is_correct: false,
                            score: 0.0,
                            feedback: format!("Incorrect: Got {:.4}, expected {:.4} (diff {:.4} > tol {:.4})", s, e, diff, tol),
                        }
                    }
                }
                _ => GradeResult {
                    student_id: sub.student_id.clone(),
                    question_id: sub.question_id.clone(),
                    is_correct: false,
                    score: 0.0,
                    feedback: "Failed to parse numeric value from student or expected answer".into(),
                },
            }
        }
        QuestionType::Symbolic => {
            // Check symbolic equivalence using CAS parser & multi-point evaluation
            let p1 = Parser::parse(&sub.student_answer);
            let p2 = Parser::parse(&sub.expected_answer);

            match (p1, p2) {
                (Ok(expr1), Ok(expr2)) => {
                    let is_equiv = test_symbolic_equivalence(&expr1, &expr2);
                    if is_equiv {
                        GradeResult {
                            student_id: sub.student_id.clone(),
                            question_id: sub.question_id.clone(),
                            is_correct: true,
                            score: 1.0,
                            feedback: "Correct! Expression is algebraically equivalent.".into(),
                        }
                    } else {
                        GradeResult {
                            student_id: sub.student_id.clone(),
                            question_id: sub.question_id.clone(),
                            is_correct: false,
                            score: 0.0,
                            feedback: format!("Incorrect: Expression '{}' is not equivalent to '{}'", sub.student_answer, sub.expected_answer),
                        }
                    }
                }
                _ => {
                    // Fallback to normalized string comparison if parsing fails
                    let norm_s = sub.student_answer.replace(" ", "");
                    let norm_e = sub.expected_answer.replace(" ", "");
                    let matches = norm_s.eq_ignore_ascii_case(&norm_e);
                    GradeResult {
                        student_id: sub.student_id.clone(),
                        question_id: sub.question_id.clone(),
                        is_correct: matches,
                        score: if matches { 1.0 } else { 0.0 },
                        feedback: if matches { "Correct match.".into() } else { "Mismatch in symbolic answer.".into() },
                    }
                }
            }
        }
        QuestionType::ExactMatch => {
            let matches = sub.student_answer.trim().eq_ignore_ascii_case(sub.expected_answer.trim());
            GradeResult {
                student_id: sub.student_id.clone(),
                question_id: sub.question_id.clone(),
                is_correct: matches,
                score: if matches { 1.0 } else { 0.0 },
                feedback: if matches { "Exact match confirmed.".into() } else { "Answer does not match expected key.".into() },
            }
        }
    }
}

/// Tests whether two algebraic expressions are equivalent by testing across sample points
fn test_symbolic_equivalence(e1: &Expr, e2: &Expr) -> bool {
    let test_points = [-3.5, -2.0, -0.5, 0.5, 1.5, 2.0, 4.0];
    for &x in &test_points {
        let v1 = eval_expr_point(e1, x);
        let v2 = eval_expr_point(e2, x);

        if v1.is_nan() || v2.is_nan() {
            continue;
        }

        if (v1 - v2).abs() > 1e-4 {
            return false;
        }
    }
    true
}

/// Evaluates single variable expression f(x) at point x
fn eval_expr_point(expr: &Expr, x: f64) -> f64 {
    match expr {
        Expr::Num(n) => *n,
        Expr::Var(_) => x,
        Expr::Add(terms) => terms.iter().map(|t| eval_expr_point(t, x)).sum(),
        Expr::Mul(terms) => terms.iter().map(|t| eval_expr_point(t, x)).product(),
        Expr::Div(a, b) => {
            let denom = eval_expr_point(b, x);
            if denom.abs() < 1e-12 { f64::NAN } else { eval_expr_point(a, x) / denom }
        }
        Expr::Pow(base, exp) => eval_expr_point(base, x).powf(eval_expr_point(exp, x)),
        Expr::Neg(inner) => -eval_expr_point(inner, x),
        Expr::Sin(arg) => eval_expr_point(arg, x).sin(),
        Expr::Cos(arg) => eval_expr_point(arg, x).cos(),
        Expr::Tan(arg) => eval_expr_point(arg, x).tan(),
        Expr::Exp(arg) => eval_expr_point(arg, x).exp(),
        Expr::Ln(arg) => {
            let val = eval_expr_point(arg, x);
            if val > 0.0 { val.ln() } else { f64::NAN }
        }
        Expr::Sqrt(arg) => {
            let val = eval_expr_point(arg, x);
            if val >= 0.0 { val.sqrt() } else { f64::NAN }
        }
    }
}

/// Grade thousands of student exam submissions in parallel using all available CPU threads
pub fn grade_batch_parallel(submissions: &[Submission]) -> BatchGradingSummary {
    let start = std::time::Instant::now();
    let n = submissions.len();

    if n == 0 {
        return BatchGradingSummary {
            total_submissions: 0,
            passed_count: 0,
            pass_rate: 100.0,
            average_score: 0.0,
            elapsed_micros: 0.0,
            throughput_per_sec: 0.0,
            results: Vec::new(),
        };
    }

    let num_threads = thread::available_parallelism()
        .map(|p| p.get())
        .unwrap_or(4)
        .min(n);

    let chunk_size = (n + num_threads - 1) / num_threads;

    let results = thread::scope(|s| {
        let mut handles = Vec::with_capacity(num_threads);

        for chunk in submissions.chunks(chunk_size) {
            let handle = s.spawn(move || {
                let mut chunk_res = Vec::with_capacity(chunk.len());
                for sub in chunk {
                    chunk_res.push(grade_submission(sub));
                }
                chunk_res
            });
            handles.push(handle);
        }

        let mut all_results = Vec::with_capacity(n);
        for h in handles {
            if let Ok(res) = h.join() {
                all_results.extend(res);
            }
        }
        all_results
    });

    let elapsed = start.elapsed();
    let elapsed_micros = elapsed.as_secs_f64() * 1_000_000.0;
    let throughput = if elapsed.as_secs_f64() > 0.0 {
        n as f64 / elapsed.as_secs_f64()
    } else {
        0.0
    };

    let passed_count = results.iter().filter(|r| r.is_correct).count();
    let total_score: f64 = results.iter().map(|r| r.score).sum();
    let avg_score = total_score / (n as f64);
    let pass_rate = (passed_count as f64 / n as f64) * 100.0;

    BatchGradingSummary {
        total_submissions: n,
        passed_count,
        pass_rate,
        average_score: avg_score,
        elapsed_micros,
        throughput_per_sec: throughput,
        results,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_numeric_grading() {
        let sub = Submission {
            student_id: "student_1".into(),
            question_id: "q_gravity".into(),
            student_answer: "9.81".into(),
            expected_answer: "9.8".into(),
            question_type: QuestionType::Numeric { tolerance: 0.05 },
        };
        let res = grade_submission(&sub);
        assert!(res.is_correct);
    }

    #[test]
    fn test_symbolic_grading() {
        let sub = Submission {
            student_id: "student_2".into(),
            question_id: "q_algebra".into(),
            student_answer: "(x + 1) * (x + 1)".into(),
            expected_answer: "x^2 + 2x + 1".into(),
            question_type: QuestionType::Symbolic,
        };
        let res = grade_submission(&sub);
        assert!(res.is_correct);
    }

    #[test]
    fn test_parallel_batch_grading() {
        let mut subs = Vec::new();
        for i in 0..1000 {
            subs.push(Submission {
                student_id: format!("student_{}", i),
                question_id: "q_poly".into(),
                student_answer: if i % 2 == 0 { "2x + 4".into() } else { "3x + 1".into() },
                expected_answer: "2*(x + 2)".into(),
                question_type: QuestionType::Symbolic,
            });
        }

        let summary = grade_batch_parallel(&subs);
        assert_eq!(summary.total_submissions, 1000);
        assert_eq!(summary.passed_count, 500);
        assert!(summary.elapsed_micros < 50_000.0, "1000 submissions should take < 50ms");
    }
}
