# Sentiment Analysis — Decoding Emotion with Active MLOps & Batch Analytics

[![Python](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.0%2B-green.svg)](https://flask.palletsprojects.com/)
[![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-1.4%2B-orange.svg)](https://scikit-learn.org/)
[![Docker](https://img.shields.io/badge/Docker-Hub-blue.svg)](https://hub.docker.com/r/suhas29/sentiment-analysis-nlp)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An enterprise-grade sentiment analysis application featuring a double-engine classifier (Logistic Regression vs. VADER Lexicon), negation-aware text preprocessing, voice dictation, real-time MLOps active feedback loops with in-memory model hot-swapping, and a batch CSV analytics dashboard.

---

## 🌟 Key Features

* **Double-Engine Classifier:** Choose between a Machine Learning model (TfidfVectorizer + Logistic Regression) and a Lexicon-based rule system (VADER).
* **Negation-Aware Preprocessing:** Preserves critical negation keywords (`not`, `no`, `never`, `without`, etc.) during stopword filtering, allowing the model to accurately classify negated phrases (e.g., *"not bad"* as positive).
* **Active MLOps Retraining Loop:** Submit sentiment corrections directly from the UI. Retrain the Logistic Regression model in **under 1.5 seconds** (optimized via pre-tokenized training data caching) and hot-swap the classifier in-memory without server downtime.
* **Collapsible Performance History:** Toggle a live-updating line chart (using Chart.js) and scrollable run log detailing the progression of validation accuracy (starting from the baseline **69.45%**) after every training run.
* **Cross-Browser Voice Dictation:** Integrated Web Speech API for real-time speech-to-text. Bypasses Edge's continuous-mode connection drops using a custom state-preserving restart loop.
* **Batch CSV Dataset Analyzer:** Ingest raw CSV files, automatically map text columns, view interactive distribution donut charts and top keywords frequency bar charts, search/filter rows, and download the fully labeled dataset.

---

## 📂 Repository Structure

```
sentiment-analysis-nlp/
├── DataSet/
│   ├── feedback.csv
│   ├── test.csv
│   ├── train.csv
│   └── train_clean.csv
├── Dockerfile
├── LICENSE
├── Model/
│   ├── model_metadata.json
│   ├── retrain_history.json
│   ├── sentiment-analysis.ipynb
│   └── sentiment_analysis_model.pkl
├── README.md
├── implementation_plan.md
├── customer_feedback_dump.csv
├── step1_train_model.py
├── .dockerignore
├── .gitignore
├── venv/
└── WebSite/
    ├── api.py
    ├── index.html
    ├── requirements.txt
    ├── script.js
    ├── styles.css
    └── temp_batches/
```
├── Dockerfile                        # Container build definition
├── implementation_plan.md            # Architecture & design notes
├── LICENSE                           # MIT License
└── README.md                         # Project documentation

```
---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/Suhas-G-r/sentiment-analysis-nlp.git
cd sentiment-analysis-nlp
```

### 2. Set up Virtual Environment & Install Dependencies
Ensure you have Python 3.9+ installed:
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On Windows (Command Prompt):
.\venv\Scripts\activate.bat
# On macOS/Linux:
source venv/bin/activate

# Install requirements
pip install -r WebSite/requirements.txt
```

### 3. Run the Application
Start the Flask backend server:
```bash
python WebSite/api.py
```
Once the server starts up, open your web browser and navigate to:
👉 **[http://localhost:5000](http://localhost:5000)**

---

## 🐳 Run with Docker

No Python setup needed — pull the pre-built image straight from Docker Hub:

```bash
docker pull suhas29/sentiment-analysis-nlp:latest
docker run -p 5000:5000 suhas29/sentiment-analysis-nlp:latest
```

Then open **[http://localhost:5000](http://localhost:5000)** in your browser.

🔗 **Docker Hub:** [suhas29/sentiment-analysis-nlp](https://hub.docker.com/r/suhas29/sentiment-analysis-nlp)

<details>
<summary>Or build the image yourself from source</summary>

```bash
git clone https://github.com/Suhas-G-r/sentiment-analysis-nlp.git
cd sentiment-analysis-nlp
docker build -t sentiment-analysis-nlp .
docker run -p 5000:5000 sentiment-analysis-nlp
```
</details>

---

## ⚙️ How It Works (Under the Hood)

### Text Preprocessing & TF-IDF Vectorization
The text is normalized (lowercased, punctuation/mentions/hashtags removed) and tokenized using NLTK. We exclude negations from the standard English stopword list to preserve contextual meaning. The text is converted to numerical features using a TF-IDF vectorizer extracting both unigrams and bigrams (`ngram_range=(1, 2)`), capped at `10,000` features.

### Machine Learning Classification
We train a `Logistic Regression` classifier (`max_iter=1000`) using an 80/20 train/test split. 
* **Baseline Validation Accuracy:** **`69.45%`**
* **In-Memory Hot-Swapping:** When a user corrects a prediction, the server appends the row to `feedback.csv`. When retraining is triggered, it fits the pipeline on the merged dataset and swaps the active `model` and vocabulary coefficients dynamically in global memory. Subsequent requests immediately reflect the updated coefficients.

### Batch Processing Vectorization
Instead of using slow row-by-row iteration loops, the `/analyze_batch` endpoint utilizes `pandas` vectors to classify entire CSV sheets in parallel, generating statistics and returning structured JSON metadata to render Chart.js graphs on the frontend.

---

## 🛠️ Technologies Used

* **Python:** Core programming language.
* **Flask:** REST API endpoints and static file serving.
* **Scikit-learn:** TF-IDF feature extraction, model selection, and Logistic Regression classification.
* **NLTK:** Natural Language Toolkit (tokenizers, lemmatizers, stopwords).
* **Chart.js:** Frontend interactive visualizations (donut charts, bar charts, line graphs).
* **Web Speech API:** HTML5 browser speech-recognition engine.
* **Pandas:** High-performance data manipulation and vectorized file processing.
* **Docker:** Containerized deployment for consistent, portable environments.

---

Crafted with precision and a passion for engineering by **Suhas G R**.