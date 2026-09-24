//! LaTeX Math normalization and equation extraction for Tark.

use regex::Regex;
use std::sync::OnceLock;

static LATEX_BLOCK_REGEX: OnceLock<Regex> = OnceLock::new();
static FRAC_REGEX: OnceLock<Regex> = OnceLock::new();
static SUP_REGEX: OnceLock<Regex> = OnceLock::new();

fn get_latex_block_regex() -> &'static Regex {
    LATEX_BLOCK_REGEX.get_or_init(|| {
        Regex::new(r"(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^\$\n]+?\$)").unwrap()
    })
}

fn get_frac_regex() -> &'static Regex {
    FRAC_REGEX.get_or_init(|| {
        Regex::new(r"\\frac\{([^{}]+)\}\{([^{}]+)\}").unwrap()
    })
}

fn get_sup_regex() -> &'static Regex {
    SUP_REGEX.get_or_init(|| {
        Regex::new(r"\^\{([^{}]+)\}").unwrap()
    })
}

/// Normalizes LaTeX math syntax into standard arithmetic string:
/// e.g. `\frac{100}{4}` -> `(100) / (4)`
/// `12 \times 8` -> `12 * 8`
/// `2^{10}` -> `2 ^ 10`
pub fn normalize_latex_math(latex: &str) -> String {
    let mut s = latex
        .replace("$$", "")
        .replace("\\[", "")
        .replace("\\]", "")
        .replace("$", "")
        .replace("\\times", "*")
        .replace("\\cdot", "*")
        .replace("\\div", "/")
        .replace("\\left(", "(")
        .replace("\\right)", ")")
        .replace("\\left[", "(")
        .replace("\\right]", ")")
        .replace("\\left\\{", "(")
        .replace("\\right\\}", ")")
        .replace("\\,", " ")
        .replace("\\;", " ")
        .replace("\\quad", " ")
        .replace("\\qquad", " ")
        .replace("\\!", "");

    // Normalize \frac{a}{b} -> ($1) / ($2)
    let frac_re = get_frac_regex();
    while frac_re.is_match(&s) {
        s = frac_re.replace_all(&s, "($1) / ($2)").to_string();
    }

    // Normalize ^{n} -> ^n
    let sup_re = get_sup_regex();
    s = sup_re.replace_all(&s, "^$1").to_string();

    s
}

/// Extracts all LaTeX math blocks from text, normalizes them, and returns
/// a concatenated string suitable for arithmetic scanning.
pub fn extract_and_normalize_latex(text: &str) -> String {
    let block_re = get_latex_block_regex();
    let mut normalized_blocks = Vec::new();

    for mat in block_re.find_iter(text) {
        let raw = mat.as_str();
        let normalized = normalize_latex_math(raw);
        normalized_blocks.push(normalized);
    }

    normalized_blocks.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_latex_normalization() {
        let latex = r"$$\frac{100}{4} = 25$$";
        let norm = normalize_latex_math(latex);
        assert!(norm.contains("((100) / (4)) = 25"));

        let times = r"$12 \times 8 = 94$";
        let norm_times = normalize_latex_math(times);
        assert!(norm_times.contains("12 * 8 = 94"));

        let power = r"$$2^{10} = 1000$$";
        let norm_power = normalize_latex_math(power);
        assert!(norm_power.contains("2^10 = 1000"));
    }
}
