//! Symbolic Differentiation with Step-by-Step Pedagogical Explanations.

use crate::cas::ast::Expr;

#[derive(Debug, Clone)]
pub struct DerivationStep {
    pub rule: String,
    pub explanation: String,
    pub latex: String,
}

pub struct Differentiator {
    var: String,
    steps: Vec<DerivationStep>,
}

impl Differentiator {
    pub fn new(var: &str) -> Self {
        Self {
            var: var.to_string(),
            steps: Vec::new(),
        }
    }

    pub fn differentiate(&mut self, expr: &Expr) -> (Expr, Vec<DerivationStep>) {
        self.steps.clear();
        let deriv = self.diff(expr);
        let simplified = deriv.simplify();
        (simplified, self.steps.clone())
    }

    fn diff(&mut self, expr: &Expr) -> Expr {
        match expr {
            Expr::Num(_) => {
                let res = Expr::num(0.0);
                self.steps.push(DerivationStep {
                    rule: "Constant Rule".to_string(),
                    explanation: format!("The derivative of any constant is 0: \\frac{{d}}{{d{}}} (c) = 0", self.var),
                    latex: format!("\\frac{{d}}{{d{}}}\\left[{}\\right] = 0", self.var, expr.to_katex()),
                });
                res
            }

            Expr::Var(v) => {
                if v == &self.var {
                    let res = Expr::num(1.0);
                    self.steps.push(DerivationStep {
                        rule: "Variable Rule".to_string(),
                        explanation: format!("The derivative of the variable with respect to itself is 1: \\frac{{d}}{{d{}}} ({}) = 1", self.var, self.var),
                        latex: format!("\\frac{{d}}{{d{}}}\\left[{}\\right] = 1", self.var, v),
                    });
                    res
                } else {
                    // Differentiating independent variable -> 0
                    Expr::num(0.0)
                }
            }

            Expr::Neg(inner) => {
                let d_inner = self.diff(inner);
                Expr::neg(d_inner)
            }

            Expr::Add(terms) => {
                self.steps.push(DerivationStep {
                    rule: "Sum Rule".to_string(),
                    explanation: format!("Differentiate each term individually: \\frac{{d}}{{d{}}}[u + v] = \\frac{{du}}{{d{}}} + \\frac{{dv}}{{d{}}}", self.var, self.var, self.var),
                    latex: format!("\\frac{{d}}{{d{}}}\\left[{}\\right]", self.var, expr.to_katex()),
                });

                let mut d_terms = Vec::new();
                for t in terms {
                    d_terms.push(self.diff(t));
                }
                Expr::Add(d_terms).simplify()
            }

            Expr::Mul(terms) => {
                if terms.len() == 2 {
                    let u = &terms[0];
                    let v = &terms[1];
                    let du = self.diff(u);
                    let dv = self.diff(v);

                    self.steps.push(DerivationStep {
                        rule: "Product Rule".to_string(),
                        explanation: "Apply product rule: (u \\cdot v)' = u'v + uv'".to_string(),
                        latex: format!("\\frac{{d}}{{d{}}}\\left[{} \\cdot {}\\right] = \\left({}\\right){} + {}\\left({}\\right)",
                            self.var, u.to_katex(), v.to_katex(), du.to_katex(), v.to_katex(), u.to_katex(), dv.to_katex()),
                    });

                    Expr::add(Expr::mul(du, v.clone()), Expr::mul(u.clone(), dv)).simplify()
                } else if terms.len() > 2 {
                    let u = terms[0].clone();
                    let v = Expr::Mul(terms[1..].to_vec()).simplify();
                    let du = self.diff(&u);
                    let dv = self.diff(&v);
                    Expr::add(Expr::mul(du, v.clone()), Expr::mul(u, dv)).simplify()
                } else if terms.len() == 1 {
                    self.diff(&terms[0])
                } else {
                    Expr::num(0.0)
                }
            }

            Expr::Div(num, den) => {
                let u = num.as_ref();
                let v = den.as_ref();
                let du = self.diff(u);
                let dv = self.diff(v);

                self.steps.push(DerivationStep {
                    rule: "Quotient Rule".to_string(),
                    explanation: "Apply quotient rule: \\left(\\frac{u}{v}\\right)' = \\frac{u'v - uv'}{v^2}".to_string(),
                    latex: format!("\\frac{{d}}{{d{}}}\\left[\\frac{{{}}}{{{}}}\\right] = \\frac{{\\left({}\\right){} - {}\\left({}\\right)}}{{{}^2}}",
                        self.var, u.to_katex(), v.to_katex(), du.to_katex(), v.to_katex(), u.to_katex(), dv.to_katex(), v.to_katex()),
                });

                let num_res = Expr::add(Expr::mul(du, v.clone()), Expr::neg(Expr::mul(u.clone(), dv)));
                let den_res = Expr::pow(v.clone(), Expr::num(2.0));
                Expr::div(num_res, den_res).simplify()
            }

            Expr::Pow(base, exp) => {
                match (base.as_ref(), exp.as_ref()) {
                    (Expr::Var(v), Expr::Num(n)) if v == &self.var => {
                        // Standard Power Rule: d/dx (x^n) = n * x^(n-1)
                        self.steps.push(DerivationStep {
                            rule: "Power Rule".to_string(),
                            explanation: format!("Power rule: \\frac{{d}}{{d{}}} {}^{{{}}} = {} {}^{{{}}}", self.var, self.var, n, n, self.var, n - 1.0),
                            latex: format!("\\frac{{d}}{{d{}}}\\left[{}^{{{}}}\\right] = {} {}^{{{}}}", self.var, self.var, n, n, self.var, n - 1.0),
                        });
                        Expr::mul(Expr::num(*n), Expr::pow(Expr::var(v), Expr::num(n - 1.0))).simplify()
                    }
                    (u, Expr::Num(n)) => {
                        // Generalized Power / Chain Rule: d/dx (u^n) = n u^(n-1) * u'
                        let du = self.diff(u);
                        self.steps.push(DerivationStep {
                            rule: "Generalized Power Rule".to_string(),
                            explanation: "Apply power rule with chain rule: (u^n)' = n u^{n-1} u'".to_string(),
                            latex: format!("\\frac{{d}}{{d{}}}\\left[{}^{{{}}}\\right] = {} {}^{{{}}} \\cdot \\left({}\\right)",
                                self.var, u.to_katex(), n, n, u.to_katex(), n - 1.0, du.to_katex()),
                        });
                        Expr::mul(Expr::mul(Expr::num(*n), Expr::pow(u.clone(), Expr::num(n - 1.0))), du).simplify()
                    }
                    _ => {
                        // Exponential or variable base: d/dx (u^v) = u^v * (v' ln u + v u'/u)
                        let du = self.diff(base);
                        let dv = self.diff(exp);
                        let term1 = Expr::mul(dv, Expr::ln(*base.clone()));
                        let term2 = Expr::mul(*exp.clone(), Expr::div(du, *base.clone()));
                        Expr::mul(expr.clone(), Expr::add(term1, term2)).simplify()
                    }
                }
            }

            Expr::Sin(inner) => {
                let du = self.diff(inner);
                self.steps.push(DerivationStep {
                    rule: "Trigonometric Sine Rule".to_string(),
                    explanation: "Derivative of \\sin(u) is \\cos(u) \\cdot u'".to_string(),
                    latex: format!("\\frac{{d}}{{d{}}}\\left[\\sin\\left({}\\right)\\right] = \\cos\\left({}\\right) \\cdot \\left({}\\right)",
                        self.var, inner.to_katex(), inner.to_katex(), du.to_katex()),
                });
                Expr::mul(Expr::cos(*inner.clone()), du).simplify()
            }

            Expr::Cos(inner) => {
                let du = self.diff(inner);
                self.steps.push(DerivationStep {
                    rule: "Trigonometric Cosine Rule".to_string(),
                    explanation: "Derivative of \\cos(u) is -\\sin(u) \\cdot u'".to_string(),
                    latex: format!("\\frac{{d}}{{d{}}}\\left[\\cos\\left({}\\right)\\right] = -\\sin\\left({}\\right) \\cdot \\left({}\\right)",
                        self.var, inner.to_katex(), inner.to_katex(), du.to_katex()),
                });
                Expr::mul(Expr::neg(Expr::sin(*inner.clone())), du).simplify()
            }

            Expr::Tan(inner) => {
                let du = self.diff(inner);
                // (tan u)' = sec^2(u) * u' = (1 + tan^2(u)) * u'
                self.steps.push(DerivationStep {
                    rule: "Trigonometric Tangent Rule".to_string(),
                    explanation: "Derivative of \\tan(u) is \\sec^2(u) \\cdot u'".to_string(),
                    latex: format!("\\frac{{d}}{{d{}}}\\left[\\tan\\left({}\\right)\\right] = \\sec^2\\left({}\\right) \\cdot \\left({}\\right)",
                        self.var, inner.to_katex(), inner.to_katex(), du.to_katex()),
                });
                let sec2 = Expr::add(Expr::num(1.0), Expr::pow(Expr::tan(*inner.clone()), Expr::num(2.0)));
                Expr::mul(sec2, du).simplify()
            }

            Expr::Exp(inner) => {
                let du = self.diff(inner);
                self.steps.push(DerivationStep {
                    rule: "Exponential Rule".to_string(),
                    explanation: "Derivative of e^u is e^u \\cdot u'".to_string(),
                    latex: format!("\\frac{{d}}{{d{}}}\\left[e^{{{}}}\\right] = e^{{{}}} \\cdot \\left({}\\right)",
                        self.var, inner.to_katex(), inner.to_katex(), du.to_katex()),
                });
                Expr::mul(Expr::exp(*inner.clone()), du).simplify()
            }

            Expr::Ln(inner) => {
                let du = self.diff(inner);
                self.steps.push(DerivationStep {
                    rule: "Logarithm Rule".to_string(),
                    explanation: "Derivative of \\ln(u) is \\frac{u'}{u}".to_string(),
                    latex: format!("\\frac{{d}}{{d{}}}\\left[\\ln\\left({}\\right)\\right] = \\frac{{{}}}{{{}}}",
                        self.var, inner.to_katex(), du.to_katex(), inner.to_katex()),
                });
                Expr::div(du, *inner.clone()).simplify()
            }

            Expr::Sqrt(inner) => {
                let du = self.diff(inner);
                self.steps.push(DerivationStep {
                    rule: "Square Root Rule".to_string(),
                    explanation: "Derivative of \\sqrt{u} is \\frac{u'}{2\\sqrt{u}}".to_string(),
                    latex: format!("\\frac{{d}}{{d{}}}\\left[\\sqrt{{{}}}\\right] = \\frac{{{}}}{{2\\sqrt{{{}}}}}",
                        self.var, inner.to_katex(), du.to_katex(), inner.to_katex()),
                });
                let den = Expr::mul(Expr::num(2.0), Expr::sqrt(*inner.clone()));
                Expr::div(du, den).simplify()
            }
        }
    }
}
