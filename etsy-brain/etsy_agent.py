"""Etsy agent: tracks listings, prices, and margins."""
import sys
from database import init_db, query, execute


def add_listing(sku, title, description, price, cost, niche):
    return execute(
        """INSERT INTO etsy_listings (sku, title, description, price, cost, niche)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (sku, title, description, price, cost, niche),
    )


def list_listings(niche=None):
    if niche:
        return query("SELECT * FROM etsy_listings WHERE niche = ?", (niche,))
    return query("SELECT * FROM etsy_listings ORDER BY created_at DESC")


def margin_report():
    rows = query("SELECT sku, title, price, cost FROM etsy_listings")
    for r in rows:
        margin = (r["price"] or 0) - (r["cost"] or 0)
        print(f"{r['sku']:10} {r['title'][:30]:30} price={r['price']} cost={r['cost']} margin={margin:.2f}")


if __name__ == "__main__":
    init_db()
    if len(sys.argv) < 2 or sys.argv[1] == "list":
        for row in list_listings():
            print(row)
    elif sys.argv[1] == "margins":
        margin_report()
