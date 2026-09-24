import sqlite3

conn = sqlite3.connect("tark.db")
c = conn.cursor()
tables = [row[0] for row in c.execute("SELECT name FROM sqlite_master WHERE type='table'")]
print("Tables:", tables)

if "custom_simulations" in tables:
    rows = c.execute("SELECT id, title, subject, length(html_content) FROM custom_simulations").fetchall()
    print("Custom simulations:", rows)
    if rows:
        last_id = rows[-1][0]
        html = c.execute("SELECT html_content FROM custom_simulations WHERE id = ?", (last_id,)).fetchone()[0]
        with open("last_generated_sim.html", "w", encoding="utf-8") as f:
            f.write(html)
        print("Saved last_generated_sim.html, size:", len(html))
