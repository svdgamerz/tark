//! Symbolic Expression AST and Algebraic Simplification Engine.

use std::fmt;

#[derive(Debug, Clone, PartialEq)]
pub enum Expr {
    Num(f64),
    Var(String),
    Add(Vec<Expr>),
    Mul(Vec<Expr>),
    Div(Box<Expr>, Box<Expr>),
    Pow(Box<Expr>, Box<Expr>),
    Neg(Box<Expr>),
    Sin(Box<Expr>),
    Cos(Box<Expr>),
    Tan(Box<Expr>),
    Exp(Box<Expr>),
    Ln(Box<Expr>),
    Sqrt(Box<Expr>),
}

impl Expr {
    pub fn num(n: f64) -> Self {
        Expr::Num(n)
    }

    pub fn var(s: &str) -> Self {
        Expr::Var(s.to_string())
    }

    pub fn add(a: Expr, b: Expr) -> Self {
        Expr::Add(vec![a, b]).simplify()
    }

    pub fn mul(a: Expr, b: Expr) -> Self {
        Expr::Mul(vec![a, b]).simplify()
    }

    pub fn div(a: Expr, b: Expr) -> Self {
        Expr::Div(Box::new(a), Box::new(b)).simplify()
    }

    pub fn pow(a: Expr, b: Expr) -> Self {
        Expr::Pow(Box::new(a), Box::new(b)).simplify()
    }

    pub fn neg(a: Expr) -> Self {
        Expr::Neg(Box::new(a)).simplify()
    }

    pub fn sin(a: Expr) -> Self {
        Expr::Sin(Box::new(a)).simplify()
    }

    pub fn cos(a: Expr) -> Self {
        Expr::Cos(Box::new(a)).simplify()
    }

    pub fn tan(a: Expr) -> Self {
        Expr::Tan(Box::new(a)).simplify()
    }

    pub fn exp(a: Expr) -> Self {
        Expr::Exp(Box::new(a)).simplify()
    }

    pub fn ln(a: Expr) -> Self {
        Expr::Ln(Box::new(a)).simplify()
    }

    pub fn sqrt(a: Expr) -> Self {
        Expr::Sqrt(Box::new(a)).simplify()
    }

    /// Check if expression is numeric zero (with floating point tolerance)
    pub fn is_zero(&self) -> bool {
        match self {
            Expr::Num(n) => n.abs() < 1e-12,
            _ => false,
        }
    }

    /// Check if expression is numeric one
    pub fn is_one(&self) -> bool {
        match self {
            Expr::Num(n) => (n - 1.0).abs() < 1e-12,
            _ => false,
        }
    }

    /// Recursively simplify expression using standard algebraic identities
    pub fn simplify(&self) -> Expr {
        match self {
            Expr::Num(n) => Expr::Num(*n),
            Expr::Var(s) => Expr::Var(s.clone()),

            Expr::Neg(inner) => {
                let s = inner.simplify();
                match s {
                    Expr::Num(n) => Expr::Num(-n),
                    Expr::Neg(nested) => *nested,
                    _ => Expr::Neg(Box::new(s)),
                }
            }

            Expr::Add(terms) => {
                let mut const_sum = 0.0;
                let mut simplified_terms = Vec::new();

                for t in terms {
                    let st = t.simplify();
                    match st {
                        Expr::Num(n) => const_sum += n,
                        Expr::Add(nested) => {
                            for nt in nested {
                                match nt {
                                    Expr::Num(n) => const_sum += n,
                                    _ => simplified_terms.push(nt),
                                }
                            }
                        }
                        _ => simplified_terms.push(st),
                    }
                }

                if const_sum.abs() > 1e-12 {
                    simplified_terms.insert(0, Expr::Num(const_sum));
                }

                if simplified_terms.is_empty() {
                    Expr::Num(0.0)
                } else if simplified_terms.len() == 1 {
                    simplified_terms.remove(0)
                } else {
                    Expr::Add(simplified_terms)
                }
            }

            Expr::Mul(terms) => {
                let mut const_prod = 1.0;
                let mut simplified_terms = Vec::new();

                for t in terms {
                    let st = t.simplify();
                    match st {
                        Expr::Num(n) => {
                            if n.abs() < 1e-12 {
                                return Expr::Num(0.0);
                            }
                            const_prod *= n;
                        }
                        Expr::Mul(nested) => {
                            for nt in nested {
                                match nt {
                                    Expr::Num(n) => {
                                        if n.abs() < 1e-12 {
                                            return Expr::Num(0.0);
                                        }
                                        const_prod *= n;
                                    }
                                    _ => simplified_terms.push(nt),
                                }
                            }
                        }
                        _ => simplified_terms.push(st),
                    }
                }

                if (const_prod - 1.0).abs() > 1e-12 || simplified_terms.is_empty() {
                    simplified_terms.insert(0, Expr::Num(const_prod));
                }

                if simplified_terms.len() == 1 {
                    simplified_terms.remove(0)
                } else {
                    Expr::Mul(simplified_terms)
                }
            }

            Expr::Div(num, den) => {
                let s_num = num.simplify();
                let s_den = den.simplify();

                if s_num.is_zero() {
                    return Expr::Num(0.0);
                }
                if s_den.is_one() {
                    return s_num;
                }

                match (&s_num, &s_den) {
                    (Expr::Num(a), Expr::Num(b)) => {
                        if b.abs() > 1e-12 {
                            Expr::Num(a / b)
                        } else {
                            Expr::Div(Box::new(s_num), Box::new(s_den))
                        }
                    }
                    _ if s_num == s_den => Expr::Num(1.0),
                    _ => Expr::Div(Box::new(s_num), Box::new(s_den)),
                }
            }

            Expr::Pow(base, exp) => {
                let s_base = base.simplify();
                let s_exp = exp.simplify();

                if s_exp.is_zero() {
                    return Expr::Num(1.0);
                }
                if s_exp.is_one() {
                    return s_base;
                }
                if s_base.is_zero() {
                    return Expr::Num(0.0);
                }
                if s_base.is_one() {
                    return Expr::Num(1.0);
                }

                match (&s_base, &s_exp) {
                    (Expr::Num(b), Expr::Num(e)) => Expr::Num(b.powf(*e)),
                    _ => Expr::Pow(Box::new(s_base), Box::new(s_exp)),
                }
            }

            Expr::Sin(inner) => {
                let s = inner.simplify();
                if let Expr::Num(n) = s {
                    Expr::Num(n.sin())
                } else {
                    Expr::Sin(Box::new(s))
                }
            }

            Expr::Cos(inner) => {
                let s = inner.simplify();
                if let Expr::Num(n) = s {
                    Expr::Num(n.cos())
                } else {
                    Expr::Cos(Box::new(s))
                }
            }

            Expr::Tan(inner) => {
                let s = inner.simplify();
                if let Expr::Num(n) = s {
                    Expr::Num(n.tan())
                } else {
                    Expr::Tan(Box::new(s))
                }
            }

            Expr::Exp(inner) => {
                let s = inner.simplify();
                if s.is_zero() {
                    Expr::Num(1.0)
                } else if let Expr::Num(n) = s {
                    Expr::Num(n.exp())
                } else {
                    Expr::Exp(Box::new(s))
                }
            }

            Expr::Ln(inner) => {
                let s = inner.simplify();
                if s.is_one() {
                    Expr::Num(0.0)
                } else if let Expr::Num(n) = s {
                    Expr::Num(n.ln())
                } else {
                    Expr::Ln(Box::new(s))
                }
            }

            Expr::Sqrt(inner) => {
                let s = inner.simplify();
                if let Expr::Num(n) = s {
                    if n >= 0.0 {
                        Expr::Num(n.sqrt())
                    } else {
                        Expr::Sqrt(Box::new(Expr::Num(n)))
                    }
                } else {
                    Expr::Sqrt(Box::new(s))
                }
            }
        }
    }

    /// Format as standard KaTeX mathematical notation
    pub fn to_katex(&self) -> String {
        match self {
            Expr::Num(n) => {
                if (n.fract()).abs() < 1e-9 {
                    format!("{:.0}", n)
                } else {
                    format!("{:.3}", n).trim_end_matches('0').trim_end_matches('.').to_string()
                }
            }
            Expr::Var(v) => v.clone(),
            Expr::Neg(inner) => format!("-{}", inner.to_katex_wrapped()),
            Expr::Add(terms) => {
                if terms.is_empty() {
                    return "0".to_string();
                }
                let mut s = terms[0].to_katex();
                for t in &terms[1..] {
                    if let Expr::Neg(inner) = t {
                        s.push_str(&format!(" - {}", inner.to_katex()));
                    } else {
                        s.push_str(&format!(" + {}", t.to_katex()));
                    }
                }
                s
            }
            Expr::Mul(terms) => {
                let mut parts = Vec::new();
                for t in terms {
                    parts.push(t.to_katex_wrapped());
                }
                parts.join(" \\cdot ")
            }
            Expr::Div(num, den) => {
                format!("\\frac{{{}}}{{{}}}", num.to_katex(), den.to_katex())
            }
            Expr::Pow(base, exp) => {
                format!("{}^{{{}}}", base.to_katex_wrapped(), exp.to_katex())
            }
            Expr::Sin(inner) => format!("\\sin\\left({}\\right)", inner.to_katex()),
            Expr::Cos(inner) => format!("\\cos\\left({}\\right)", inner.to_katex()),
            Expr::Tan(inner) => format!("\\tan\\left({}\\right)", inner.to_katex()),
            Expr::Exp(inner) => format!("e^{{{}}}", inner.to_katex()),
            Expr::Ln(inner) => format!("\\ln\\left({}\\right)", inner.to_katex()),
            Expr::Sqrt(inner) => format!("\\sqrt{{{}}}", inner.to_katex()),
        }
    }

    fn to_katex_wrapped(&self) -> String {
        match self {
            Expr::Add(_) | Expr::Neg(_) => format!("\\left({}\\right)", self.to_katex()),
            _ => self.to_katex(),
        }
    }
}

impl fmt::Display for Expr {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.to_katex())
    }
}
