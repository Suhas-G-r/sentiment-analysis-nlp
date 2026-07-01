import pandas as pd
import numpy as np
import re
import pickle
import os
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, accuracy_score
from sklearn.pipeline import Pipeline

# ── 1. Load dataset ──────────────────────────────────────────────────────────
print("Loading dataset...")
df = pd.read_csv("DataSet/train.csv", encoding="latin-1")
df = df[["text", "sentiment"]].dropna()
df = df[df["sentiment"].isin(["positive", "negative", "neutral"])]
print(f"Dataset loaded: {len(df)} rows")
print(df["sentiment"].value_counts())

# ── 2. Preprocess text ───────────────────────────────────────────────────────
print("\nPreprocessing text...")
# Preserve negation keywords in the token stream so we can analyze negated sentiments correctly
negation_words = {'not', 'no', 'never', 'neither', 'nor', 'but', 'without', 'only'}
stop_words = set(stopwords.words("english")) - negation_words
lemmatizer = WordNetLemmatizer()

def preprocess(text):
    text = str(text).lower()
    text = re.sub(r"http\S+|www\S+", "", text)
    text = re.sub(r"@\w+|#\w+", "", text)
    text = re.sub(r"[^a-z\s]", "", text)
    tokens = word_tokenize(text)
    tokens = [lemmatizer.lemmatize(t) for t in tokens if t not in stop_words]
    return " ".join(tokens)

df["clean_text"] = df["text"].apply(preprocess)
print("Preprocessing done.")

# ── 3. Train/test split ──────────────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    df["clean_text"], df["sentiment"], test_size=0.2, random_state=42, stratify=df["sentiment"]
)
print(f"\nTrain: {len(X_train)} | Test: {len(X_test)}")

# ── 4. Build & train pipeline ────────────────────────────────────────────────
print("\nTraining model...")
pipeline = Pipeline([
    ("tfidf", TfidfVectorizer(max_features=10000, ngram_range=(1, 2))),
    ("clf", LogisticRegression(max_iter=1000, random_state=42))
])
pipeline.fit(X_train, y_train)

# ── 5. Evaluate ──────────────────────────────────────────────────────────────
y_pred = pipeline.predict(X_test)
print(f"\nAccuracy: {accuracy_score(y_test, y_pred):.4f}")
print("\nClassification Report:")
print(classification_report(y_test, y_pred))

# ── 6. Save model ────────────────────────────────────────────────────────────
os.makedirs("Model", exist_ok=True)
with open("Model/sentiment_analysis_model.pkl", "wb") as f:
    pickle.dump(pipeline, f)
print("\nModel saved to Model/sentiment_analysis_model.pkl")

# Save preprocessed features to DataSet/train_clean.csv as a cache for ultra-fast MLOps retraining
df[["clean_text", "sentiment"]].to_csv("DataSet/train_clean.csv", index=False)
print("MLOps preprocessed cache saved to DataSet/train_clean.csv")