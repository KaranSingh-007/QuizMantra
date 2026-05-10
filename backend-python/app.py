from flask import Flask, request, jsonify
from flask_cors import CORS
import pdfplumber
import docx
from groq import Groq
import json
import re
from dotenv import load_dotenv
import os
import io

load_dotenv()

app = Flask(__name__)
CORS(app)

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def extract_text_from_pdf(file):
    text = ""
    with pdfplumber.open(file) as pdf:
        for page in pdf.pages:
            content = page.extract_text()
            if content:
                text += content
    return text

def extract_text_from_docx(file):
    file_bytes = io.BytesIO(file.read())
    doc = docx.Document(file_bytes)
    text = ""
    for para in doc.paragraphs:
        if para.text.strip():
            text += para.text + "\n"
    return text

DIFFICULTY_INSTRUCTIONS = {
    "easy": (
        "Generate EASY questions. Focus on basic recall and definitions. "
        "Questions should be straightforward with clearly wrong distractors."
    ),
    "medium": (
        "Generate MEDIUM difficulty questions. Focus on understanding and application. "
        "Distractors should be plausible but distinguishable with careful reading."
    ),
    "hard": (
        "Generate HARD questions. Focus on deep analysis, inference, and edge cases. "
        "All options should seem plausible; only careful reasoning reveals the correct answer."
    ),
}

@app.route("/upload", methods=["POST"])
def upload():
    file = request.files.get("pdf")
    difficulty = request.form.get("difficulty", "medium")
    num_questions = request.form.get("num_questions", "10")

    try:
        num_questions = int(num_questions)
        if num_questions not in [10, 20, 30]:
            num_questions = 10
    except ValueError:
        num_questions = 10

    if difficulty not in DIFFICULTY_INSTRUCTIONS:
        difficulty = "medium"

    if not file:
        return jsonify({"error": "No file uploaded"}), 400

    filename = file.filename.lower()
    text = ""

    try:
        if filename.endswith(".pdf"):
            text = extract_text_from_pdf(file)
        elif filename.endswith(".docx"):
            text = extract_text_from_docx(file)
        else:
            return jsonify({"error": "Unsupported file type. Please upload a PDF or DOCX file."}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to read file: {str(e)}"}), 500

    if not text.strip():
        return jsonify({"error": "No text found in the file."}), 400

    difficulty_instruction = DIFFICULTY_INSTRUCTIONS[difficulty]

    prompt = f"""
{difficulty_instruction}

Generate exactly {num_questions} multiple choice questions from the text below.
Return ONLY a valid JSON array. No explanation, no markdown, no code fences.
Each question must have exactly 4 options labeled A, B, C, D.
The "answer" field must exactly match one of the options strings.

Format:
[
  {{
    "question": "...",
    "options": ["A. option1", "B. option2", "C. option3", "D. option4"],
    "answer": "A. option1"
  }}
]

Text:
{text[:4000]}
"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}]
        )

        raw = response.choices[0].message.content
        raw = re.sub(r"```(?:json)?", "", raw).strip().strip("`").strip()
        mcqs = json.loads(raw)

        if not isinstance(mcqs, list) or len(mcqs) == 0:
            return jsonify({"error": "Invalid MCQ format from AI"}), 500

        return jsonify({"mcqs": mcqs})

    except json.JSONDecodeError:
        return jsonify({"error": "AI returned invalid JSON"}), 500
    except Exception as e:
        return jsonify({"error": f"AI generation failed: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(port=5000, debug=True)