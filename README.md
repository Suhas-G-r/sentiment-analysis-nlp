# Sentiment Analysis — Decoding Emotion with Active MLOps & Batch Analytics

[![Python](https://img.shields.io/badge/Python-3.9%2B-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.0%2B-green.svg)](https://flask.palletsprojects.com/)
[![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-1.4%2B-orange.svg)](https://scikit-learn.org/)
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
Sentiment-analysis/
├── DataSet/                 # Contains the raw training dataset and preprocessed text cache
│   ├── train.csv            # Original training dataset (27,480 rows)
│   ├── train_clean.csv      # Preprocessed feature cache for ultra-fast retraining
│   └── feedback.csv         # Dynamically written user correction logs
├── Model/                   # Serialized model pipelines and training runs metadata
│   ├── sentiment_analysis_model.pkl  # Pickled Logistic Regression pipeline
│   ├── model_metadata.json          # Keeps track of accuracy & training sample size
│   └── retrain_history.json         # Logs all historical MLOps retraining runs
├── WebSite/                 # Full Flask web application
│   ├── api.py               # Flask REST API endpoints serving inference, feedback, and retraining
│   ├── index.html           # Modern white-and-blue styled dashboard UI
│   ├── script.js            # Main frontend logic (Chart.js, Web Speech API, AJAX calls)
│   ├── styles.css           # Styling rules (animations, responsive grids, overlays)
│   └── requirements.txt     # Python package requirements
├── implementation_plan.md   # Architectural design, features, and verification plan
├── LICENSE                  # MIT License
└── README.md                # Project documentation
```

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/Suhas-G-r/Sentiment-analysis.git
cd Sentiment-analysis/Sentiment-analysis-main
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

---

Crafted with precision and a passion for engineering by **Suhas G R**.
