"""Jarvis: store and recall facts. The shared knowledge base."""
import sys
from database import init_db, query, execute


def add_fact(topic, content, source=None):
    return execute(
        "INSERT INTO facts (topic, content, source) VALUES (?, ?, ?)",
        (topic, content, source),
    )


def recall(topic=None, limit=20):
    if topic:
        return query(
            "SELECT * FROM facts WHERE topic LIKE ? ORDER BY created_at DESC LIMIT ?",
            (f"%{topic}%", limit),
        )
    return query("SELECT * FROM facts ORDER BY created_at DESC LIMIT ?", (limit,))


if __name__ == "__main__":
    init_db()
    if len(sys.argv) < 2:
        print("Usage: python jarvis_agent.py add <topic> <content...>")
        print("       python jarvis_agent.py recall [topic]")
        sys.exit(0)

    cmd = sys.argv[1]
    if cmd == "add":
        topic, content = sys.argv[2], " ".join(sys.argv[3:])
        add_fact(topic, content)
        print(f"Stored fact under '{topic}'.")
    elif cmd == "recall":
        topic = sys.argv[2] if len(sys.argv) > 2 else None
        for row in recall(topic):
            print(f"[{row['created_at']}] ({row['topic']}) {row['content']}")
