pub mod latex;

use regex::Regex;
use std::collections::HashSet;
use std::sync::OnceLock;

static EQ_REGEX: OnceLock<Regex> = OnceLock::new();
static OP_REGEX: OnceLock<Regex> = OnceLock::new();

fn get_eq_regex() -> &'static Regex {
    EQ_REGEX.get_or_init(|| {
        Regex::new(r"([(\d][\d \t()+\-*/×÷^]{0,50}[\d)])[ \t]*=[ \t]*(-?\d[\d,]*)").unwrap()
    })
}

fn get_op_regex() -> &'static Regex {
    OP_REGEX.get_or_init(|| Regex::new(r"[+\-*/×÷^]").unwrap())
}

/// Tokenizer for arithmetic expressions
#[derive(Debug, Clone, PartialEq)]
enum Token {
    Number(i64),
    Plus,
    Minus,
    Mul,
    Div,
    Pow,
    LParen,
    RParen,
}

fn tokenize(expr: &str) -> Option<Vec<Token>> {
    let mut tokens = Vec::with_capacity(16);
    let chars: Vec<char> = expr.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        let c = chars[i];
        if c.is_whitespace() || c == ',' {
            i += 1;
            continue;
        }

        match c {
            '+' => {
                tokens.push(Token::Plus);
                i += 1;
            }
            '-' => {
                tokens.push(Token::Minus);
                i += 1;
            }
            '*' | '×' => {
                // Check for ** (Python power operator)
                if i + 1 < chars.len() && chars[i + 1] == '*' {
                    tokens.push(Token::Pow);
                    i += 2;
                } else {
                    tokens.push(Token::Mul);
                    i += 1;
                }
            }
            '/' | '÷' => {
                tokens.push(Token::Div);
                i += 1;
            }
            '^' => {
                tokens.push(Token::Pow);
                i += 1;
            }
            '(' => {
                tokens.push(Token::LParen);
                i += 1;
            }
            ')' => {
                tokens.push(Token::RParen);
                i += 1;
            }
            d if d.is_ascii_digit() => {
                let start = i;
                while i < chars.len() && (chars[i].is_ascii_digit() || chars[i] == ',') {
                    i += 1;
                }
                let num_str: String = chars[start..i]
                    .iter()
                    .filter(|&&ch| ch != ',')
                    .collect();
                let num = num_str.parse::<i64>().ok()?;
                tokens.push(Token::Number(num));
            }
            _ => return None,
        }
    }

    Some(tokens)
}

struct Parser<'a> {
    tokens: &'a [Token],
    pos: usize,
}

impl<'a> Parser<'a> {
    fn new(tokens: &'a [Token]) -> Self {
        Self { tokens, pos: 0 }
    }

    fn peek(&self) -> Option<&Token> {
        self.tokens.get(self.pos)
    }

    fn next(&mut self) -> Option<&Token> {
        let tok = self.tokens.get(self.pos);
        if tok.is_some() {
            self.pos += 1;
        }
        tok
    }

    // Expr = Term (('+' | '-') Term)*
    fn parse_expr(&mut self) -> Option<i64> {
        let mut left = self.parse_term()?;

        while let Some(tok) = self.peek() {
            match tok {
                Token::Plus => {
                    self.next();
                    let right = self.parse_term()?;
                    left = left.checked_add(right)?;
                }
                Token::Minus => {
                    self.next();
                    let right = self.parse_term()?;
                    left = left.checked_sub(right)?;
                }
                _ => break,
            }
        }

        Some(left)
    }

    // Term = Power (('*' | '/') Power)*
    fn parse_term(&mut self) -> Option<i64> {
        let mut left = self.parse_power()?;

        while let Some(tok) = self.peek() {
            match tok {
                Token::Mul => {
                    self.next();
                    let right = self.parse_power()?;
                    left = left.checked_mul(right)?;
                }
                Token::Div => {
                    self.next();
                    let right = self.parse_power()?;
                    if right == 0 || left % right != 0 {
                        // Only trust exact integer results (same as SymPy is_integer)
                        return None;
                    }
                    left = left.checked_div(right)?;
                }
                _ => break,
            }
        }

        Some(left)
    }

    // Power = Factor ('^' Power)? (right-associative)
    fn parse_power(&mut self) -> Option<i64> {
        let base = self.parse_factor()?;

        if let Some(Token::Pow) = self.peek() {
            self.next();
            let exp = self.parse_power()?;
            if exp < 0 {
                return None; // Non-integer result
            }
            if exp > 100 {
                return None; // Prevent excessive CPU / overflow
            }
            base.checked_pow(exp as u32)
        } else {
            Some(base)
        }
    }

    // Factor = Number | '(' Expr ')' | ('-' | '+') Factor
    fn parse_factor(&mut self) -> Option<i64> {
        match self.peek()? {
            Token::Number(n) => {
                let val = *n;
                self.next();
                Some(val)
            }
            Token::Plus => {
                self.next();
                self.parse_factor()
            }
            Token::Minus => {
                self.next();
                let val = self.parse_factor()?;
                val.checked_neg()
            }
            Token::LParen => {
                self.next();
                let val = self.parse_expr()?;
                if let Some(Token::RParen) = self.next() {
                    Some(val)
                } else {
                    None
                }
            }
            _ => None,
        }
    }
}

pub fn eval_integer_expr(expr: &str) -> Option<i64> {
    let tokens = tokenize(expr)?;
    let mut parser = Parser::new(&tokens);
    let result = parser.parse_expr()?;
    if parser.pos == tokens.len() {
        Some(result)
    } else {
        None
    }
}

/// Checks text for arithmetic equations like "12 × 8 = 94" and returns
/// a correction note if any integer computation is incorrect.
pub fn check_arithmetic_fast(text: &str, max_report: usize) -> String {
    let eq_re = get_eq_regex();
    let op_re = get_op_regex();

    let mut issues = Vec::new();
    let mut seen = HashSet::new();

    for cap in eq_re.captures_iter(text) {
        let whole_match = cap.get(0).unwrap();
        let lhs_raw = cap.get(1).unwrap().as_str();
        let rhs_raw = cap.get(2).unwrap().as_str();

        if !op_re.is_match(lhs_raw) {
            continue; // Needs an operator
        }

        // Skip if followed by a decimal point (dot followed by digit), '/', or '%'
        let end_idx = whole_match.end();
        if end_idx < text.len() {
            let remaining = &text[end_idx..];
            let next_char = remaining.chars().next().unwrap_or(' ');
            let is_decimal = next_char == '.'
                && remaining[next_char.len_utf8()..]
                    .chars()
                    .next()
                    .map_or(false, |c| c.is_ascii_digit());
            if is_decimal || next_char == '/' || next_char == '%' {
                continue;
            }
        }

        let lhs_clean = lhs_raw.trim();
        let rhs_clean = rhs_raw.trim().replace(',', "");

        let key = (lhs_clean.to_string(), rhs_clean.clone());
        if seen.contains(&key) {
            continue;
        }
        seen.insert(key);

        let rhs_val = match rhs_clean.parse::<i64>() {
            Ok(v) => v,
            Err(_) => continue,
        };

        if let Some(actual_lhs) = eval_integer_expr(lhs_clean) {
            if actual_lhs != rhs_val {
                issues.push(format!("{lhs_clean} = {rhs_clean} → actually {actual_lhs}"));
                if issues.len() >= max_report {
                    break;
                }
            }
        }
    }

    // Also scan LaTeX math blocks ($$...$$, \[...\], $...$) if budget remains
    if issues.len() < max_report {
        let latex_norm = latex::extract_and_normalize_latex(text);
        if !latex_norm.is_empty() {
            for cap in eq_re.captures_iter(&latex_norm) {
                let lhs_raw = cap.get(1).unwrap().as_str();
                let rhs_raw = cap.get(2).unwrap().as_str();

                if !op_re.is_match(lhs_raw) {
                    continue;
                }

                let lhs_clean = lhs_raw.trim();
                let rhs_clean = rhs_raw.trim().replace(',', "");

                let key = (lhs_clean.to_string(), rhs_clean.clone());
                if seen.contains(&key) {
                    continue;
                }
                seen.insert(key);

                let rhs_val = match rhs_clean.parse::<i64>() {
                    Ok(v) => v,
                    Err(_) => continue,
                };

                if let Some(actual_lhs) = eval_integer_expr(lhs_clean) {
                    if actual_lhs != rhs_val {
                        issues.push(format!("{lhs_clean} = {rhs_clean} → actually {actual_lhs}"));
                        if issues.len() >= max_report {
                            break;
                        }
                    }
                }
            }
        }
    }

    if issues.is_empty() {
        String::new()
    } else {
        format!("\n\n**Mathematical verification:** {}.", issues.join("; "))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_eval_simple() {
        assert_eq!(eval_integer_expr("12 * 8"), Some(96));
        assert_eq!(eval_integer_expr("12 × 8"), Some(96));
        assert_eq!(eval_integer_expr("100 ÷ 4"), Some(25));
        assert_eq!(eval_integer_expr("2 ^ 10"), Some(1024));
        assert_eq!(eval_integer_expr("(5 + 3) * 2"), Some(16));
        assert_eq!(eval_integer_expr("10 - 20"), Some(-10));
    }

    #[test]
    fn test_non_integer_skipped() {
        assert_eq!(eval_integer_expr("7 / 2"), None);
    }

    #[test]
    fn test_check_arithmetic() {
        let text = "Here is the calculation: 12 × 8 = 94. And also 5 + 5 = 10.";
        let note = check_arithmetic_fast(text, 3);
        assert!(note.contains("12 × 8 = 94 → actually 96"));
        assert!(!note.contains("5 + 5"));
    }
}
