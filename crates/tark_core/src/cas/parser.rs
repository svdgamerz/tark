//! Recursive-descent expression parser for Tark CAS.
//! Supports implicit multiplication, algebraic operators (+, -, *, /, ^), and standard elementary functions.

use crate::cas::ast::Expr;

#[derive(Debug, Clone, PartialEq)]
enum Token {
    Number(f64),
    Ident(String),
    Plus,
    Minus,
    Star,
    Slash,
    Caret,
    LParen,
    RParen,
    Eof,
}

pub struct Parser {
    tokens: Vec<Token>,
    pos: usize,
}

impl Parser {
    pub fn parse(input: &str) -> Result<Expr, String> {
        let tokens = tokenize(input)?;
        let mut parser = Parser { tokens, pos: 0 };
        let expr = parser.parse_expr()?;
        if parser.current() != Token::Eof {
            return Err(format!("Unexpected token after expression at position {}", parser.pos));
        }
        Ok(expr.simplify())
    }

    fn current(&self) -> Token {
        if self.pos < self.tokens.len() {
            self.tokens[self.pos].clone()
        } else {
            Token::Eof
        }
    }

    fn advance(&mut self) -> Token {
        let tok = self.current();
        if self.pos < self.tokens.len() {
            self.pos += 1;
        }
        tok
    }

    fn parse_expr(&mut self) -> Result<Expr, String> {
        self.parse_add_sub()
    }

    fn parse_add_sub(&mut self) -> Result<Expr, String> {
        let mut left = self.parse_mul_div()?;

        while let Token::Plus | Token::Minus = self.current() {
            let op = self.advance();
            let right = self.parse_mul_div()?;
            match op {
                Token::Plus => left = Expr::add(left, right),
                Token::Minus => left = Expr::add(left, Expr::neg(right)),
                _ => unreachable!(),
            }
        }

        Ok(left)
    }

    fn parse_mul_div(&mut self) -> Result<Expr, String> {
        let mut left = self.parse_pow()?;

        loop {
            match self.current() {
                Token::Star => {
                    self.advance();
                    let right = self.parse_pow()?;
                    left = Expr::mul(left, right);
                }
                Token::Slash => {
                    self.advance();
                    let right = self.parse_pow()?;
                    left = Expr::div(left, right);
                }
                // Implicit multiplication: 2x, 3(x+1), x sin(x)
                Token::Ident(_) | Token::LParen | Token::Number(_) => {
                    let right = self.parse_pow()?;
                    left = Expr::mul(left, right);
                }
                _ => break,
            }
        }

        Ok(left)
    }

    fn parse_pow(&mut self) -> Result<Expr, String> {
        let left = self.parse_unary()?;

        if let Token::Caret = self.current() {
            self.advance();
            let right = self.parse_pow()?; // Right-associative: x^y^z = x^(y^z)
            return Ok(Expr::pow(left, right));
        }

        Ok(left)
    }

    fn parse_unary(&mut self) -> Result<Expr, String> {
        match self.current() {
            Token::Minus => {
                self.advance();
                let inner = self.parse_unary()?;
                Ok(Expr::neg(inner))
            }
            Token::Plus => {
                self.advance();
                self.parse_unary()
            }
            _ => self.parse_primary(),
        }
    }

    fn parse_primary(&mut self) -> Result<Expr, String> {
        match self.current() {
            Token::Number(n) => {
                self.advance();
                Ok(Expr::num(n))
            }
            Token::Ident(name) => {
                self.advance();
                let lower = name.to_lowercase();
                // Check if followed by parentheses for function call: f(...)
                if self.current() == Token::LParen {
                    self.advance(); // consume '('
                    let arg = self.parse_expr()?;
                    if self.advance() != Token::RParen {
                        return Err(format!("Expected ')' after function argument for '{}'", lower));
                    }

                    match lower.as_str() {
                        "sin" => Ok(Expr::sin(arg)),
                        "cos" => Ok(Expr::cos(arg)),
                        "tan" => Ok(Expr::tan(arg)),
                        "exp" => Ok(Expr::exp(arg)),
                        "ln" | "log" => Ok(Expr::ln(arg)),
                        "sqrt" => Ok(Expr::sqrt(arg)),
                        _ => Err(format!("Unknown function: {}", lower)),
                    }
                } else {
                    // Variable identifier (e.g. x, y, t)
                    Ok(Expr::var(&name))
                }
            }
            Token::LParen => {
                self.advance(); // consume '('
                let inner = self.parse_expr()?;
                if self.advance() != Token::RParen {
                    return Err("Expected ')' matching '('".to_string());
                }
                Ok(inner)
            }
            other => Err(format!("Unexpected token: {:?}", other)),
        }
    }
}

fn tokenize(input: &str) -> Result<Vec<Token>, String> {
    let mut tokens = Vec::new();
    let chars: Vec<char> = input.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        let c = chars[i];

        if c.is_whitespace() {
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
            '*' => {
                tokens.push(Token::Star);
                i += 1;
            }
            '/' => {
                tokens.push(Token::Slash);
                i += 1;
            }
            '^' => {
                tokens.push(Token::Caret);
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
            '0'..='9' | '.' => {
                let mut num_str = String::new();
                while i < chars.len() && (chars[i].is_digit(10) || chars[i] == '.') {
                    num_str.push(chars[i]);
                    i += 1;
                }
                let val: f64 = num_str.parse().map_err(|e| format!("Invalid number '{}': {}", num_str, e))?;
                tokens.push(Token::Number(val));
            }
            'a'..='z' | 'A'..='Z' | '_' => {
                let mut ident = String::new();
                while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '_') {
                    ident.push(chars[i]);
                    i += 1;
                }
                tokens.push(Token::Ident(ident));
            }
            _ => {
                return Err(format!("Unexpected character: '{}'", c));
            }
        }
    }

    tokens.push(Token::Eof);
    Ok(tokens)
}
