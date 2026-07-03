# 🧠 Sentiment Analysis — Decoding Emotion with Active MLOps & Batch Analytics

[![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.0%2B-green.svg)](https://flask.palletsprojects.com/)
[![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-1.9%2B-orange.svg)](https://scikit-learn.org/)
[![Docker](https://img.shields.io/badge/Docker-Hub-blue.svg)](https://hub.docker.com/r/suhas29/sentiment-analysis-nlp)
[![Render](https://img.shields.io/badge/Deployed%20on-Render-46E3B7.svg)](https://sentiment-analysis-nlp-dnxr.onrender.com)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An enterprise-grade sentiment analysis application featuring a double-engine classifier (Logistic Regression vs. VADER Lexicon), negation-aware text preprocessing, voice dictation, real-time MLOps active feedback loops with in-memory model hot-swapping, and a batch CSV analytics dashboard.

> 🚀 **Live Demo:** [https://sentiment-analysis-nlp-dnxr.onrender.com](https://sentiment-analysis-nlp-dnxr.onrender.com)

---

## ✨ Key Features

- **Double-Engine Classifier:** Choose between a Machine Learning model (TfidfVectorizer + Logistic Regression) and a Lexicon-based rule system (VADER).
- **Negation-Aware Preprocessing:** Preserves critical negation keywords (`not`, `no`, `never`, `without`, etc.) during stopword filtering, allowing the model to accurately classify negated phrases (e.g., *"not bad"* as positive).
- **Active MLOps Retraining Loop:** Submit sentiment corrections directly from the UI. Retrain the Logistic Regression model in **under 1.5 seconds** (optimized via pre-tokenized training data caching) and hot-swap the classifier in-memory without server downtime.
- **Collapsible Performance History:** Toggle a live-updating line chart (using Chart.js) and scrollable run log detailing the progression of validation accuracy (starting from the baseline **69.45%**) after every training run.
- **Cross-Browser Voice Dictation:** Integrated Web Speech API for real-time speech-to-text. Bypasses Edge's continuous-mode connection drops using a custom state-preserving restart loop.
- **Batch CSV Dataset Analyzer:** Ingest raw CSV files, automatically map text columns, view interactive distribution donut charts and top keywords frequency bar charts, search/filter rows, and download the fully labeled dataset.

---

## 📂 Repository Structure

```text
sentiment-analysis-nlp/
├── DataSet/                 # Training and feedback datasets
├── Model/                   # Pre-trained models, history, and Jupyter notebooks
├── WebSite/                 # Frontend assets, API backend, and temp batch files
│   ├── api.py               # Flask backend application
│   ├── requirements.txt     # Python dependencies
│   ├── index.html           # Main UI
│   ├── script.js            # Frontend logic
│   └── styles.css           # Styling
├── Dockerfile               # Container build definition
├── .dockerignore            # Docker build exclusions
├── LICENSE                  # MIT License
├── README.md                # Project documentation
└── step1_train_model.py     # Initial model training script
```

---

## 🌐 Live Demo (Render)

The app is deployed and publicly accessible — no setup needed:

👉 **[https://sentiment-analysis-nlp-dnxr.onrender.com](https://sentiment-analysis-nlp-dnxr.onrender.com)**

> **Note:** The service runs on Render's free tier. It may take **~30 seconds** to wake up on the first visit if it has been inactive.

---

## 🚀 Getting Started (Local)

### 1. Clone the Repository
```bash
git clone https://github.com/Suhas-G-r/sentiment-analysis-nlp.git
cd sentiment-analysis-nlp
```

### 2. Set Up Virtual Environment & Install Dependencies
Ensure you have Python 3.11+ installed:
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
Open your web browser and navigate to: 👉 **[http://localhost:5000](http://localhost:5000)**

---

## 🐳 Run with Docker

No Python setup needed — pull the pre-built image straight from Docker Hub:

```bash
docker pull suhas29/sentiment-analysis-nlp:latest
docker run -p 5000:5000 suhas29/sentiment-analysis-nlp:latest
```

Open **[http://localhost:5000](http://localhost:5000)** in your browser.

🔗 **Docker Hub:** [suhas29/sentiment-analysis-nlp](https://hub.docker.com/r/suhas29/sentiment-analysis-nlp)

<details>
<summary><b>Or build the image yourself from source</b></summary>

```bash
git clone https://github.com/Suhas-G-r/sentiment-analysis-nlp.git
cd sentiment-analysis-nlp
docker build -t sentiment-analysis-nlp .
docker run -p 5000:5000 sentiment-analysis-nlp
```
</details>

---

## ☁️ Deployment (Render)

This project is configured for one-click deployment on [Render](https://render.com) using Docker.

**How it was deployed:**
1. Connected the GitHub repo to Render as a **Web Service**.
2. Render auto-detected the `Dockerfile` and built the image.
3. The container binds Flask to `0.0.0.0:5000`, which Render exposes publicly.

**To redeploy after a push:** Render auto-deploys on every push to `main` — no manual steps needed.

---

## ⚙️ How It Works (Under the Hood)

### Text Preprocessing & TF-IDF Vectorization
The text is normalized (lowercased, punctuation/mentions/hashtags removed) and tokenized using NLTK. We exclude negations from the standard English stopword list to preserve contextual meaning. The text is converted to numerical features using a TF-IDF vectorizer extracting both unigrams and bigrams (`ngram_range=(1, 2)`), capped at `10,000` features.

### Machine Learning Classification
We train a `Logistic Regression` classifier (`max_iter=1000`) using an 80/20 train/test split.
- **Baseline Validation Accuracy:** **`69.45%`**
- **In-Memory Hot-Swapping:** When a user corrects a prediction, the server appends the row to `feedback.csv`. When retraining is triggered, it fits the pipeline on the merged dataset and swaps the active `model` and vocabulary coefficients dynamically in global memory. Subsequent requests immediately reflect the updated coefficients.

### Batch Processing Vectorization
Instead of using slow row-by-row iteration loops, the `/analyze_batch` endpoint utilizes `pandas` vectors to classify entire CSV sheets in parallel, generating statistics and returning structured JSON metadata to render Chart.js graphs on the frontend.

---

## 🛠️ Technologies Used

| Technology | Purpose |
|---|---|
| **Python 3.11** | Core programming language |
| **Flask** | REST API endpoints and static file serving |
| **Scikit-learn** | TF-IDF feature extraction & Logistic Regression |
| **NLTK** | Tokenizers, lemmatizers, stopwords |
| **VADER** | Lexicon-based sentiment rule system |
| **Pandas** | Vectorized data manipulation & batch processing |
| **Chart.js** | Interactive donut charts, bar & line graphs |
| **Web Speech API** | Browser-native speech-to-text |
| **Docker** | Containerized, portable deployment |
| **Render** | Cloud hosting & auto-deploy from GitHub |

---

*Crafted with precision and a passion for engineering by **Suhas G R**.*