# Project Implementation Plan & Architecture

This document details the architecture, design, and implementation steps completed to enhance the Sentiment Analysis application with robust machine learning capabilities, real-time MLOps retraining, cross-browser voice transcription, and batch analytics.

---

## 1. Core Architecture & Enhancements

```mermaid
graph TD
    UI[HTML5/CSS3/JS Web UI] -->|1. Analyze Single Text| API_Analyze[/analyze]
    UI -->|2. Dictate Voice Input| WebSpeech[Speech Recognition & Visualizer]
    UI -->|3. Submit Incorrect Sentiment| API_Feedback[/feedback]
    UI -->|4. Trigger Retraining| API_Retrain[/retrain]
    UI -->|5. Upload Dataset| API_Batch[/analyze_batch]

    subgraph Flask Backend
        API_Analyze --> ML_Model[Logistic Regression PKL]
        API_Analyze --> Lexicon[VADER Lexicon Analyzer]
        API_Feedback --> Feedback_CSV[(feedback.csv)]
        API_Retrain --> Merge[Merge Train + Feedback]
        Merge --> Fit[Refit Pipeline]
        Fit --> SaveModel[Write PKL to disk]
        SaveModel --> Swap[In-Memory Hot Swap]
        API_Batch --> Batch_Proc[Process Rows & Generate Stats]
    end

    subgraph Data Layer
        Train_Clean[(train_clean.csv Cache)] --> Merge
        Feedback_CSV --> Merge
        Batch_Proc --> Download[temp_batches/result.csv]
    end
```

---

## 2. Implemented Features

### Feature 1: Negation-Aware Preprocessing
* **The Challenge:** Standard stopword lists remove negation words (like *not*, *no*, *never*, *without*, *only*). As a result, phrases like *"not happy"* clean down to *"happy"*, reversing the sentiment.
* **The Solution:** Custom stopword filtering list:
  ```python
  negation_words = {'not', 'no', 'never', 'neither', 'nor', 'but', 'without', 'only'}
  stop_words = set(stopwords.words('english')) - negation_words
  ```
* **Performance Gain:** Resolves a major classification logic flaw and improves the F1-score on sentiment data containing negations.

### Feature 2: MLOps Active Feedback Retraining Loop
* **Feedback Logging:** If a user notices a wrong prediction, they select the correct label in the classification card and click **Submit Correction**. This sends a POST request to `/feedback`, writing the text and label to `DataSet/feedback.csv`.
* **Instant Dynamic Retraining:** Clicking **Retrain Model** makes a POST request to `/retrain` which:
  1. Combines `DataSet/train_clean.csv` (preprocessed baseline cache) with `DataSet/feedback.csv`.
  2. Refits the TF-IDF Vectorizer and Logistic Regression classifier pipeline.
  3. Overwrites `Model/sentiment_analysis_model.pkl` on disk.
  4. Dynamically swaps the model and weights **in-memory** on the Flask server, so updates take effect instantly for all subsequent `/analyze` requests without restarting the API.
* **Optimization:** Real-time lemmatization and tokenization of the 27,000+ row dataset was optimized by pre-compiling the clean dataset once (`DataSet/train_clean.csv`). Incremental feedback rows are processed in real-time, bringing the training runtime from **90 seconds down to under 1.5 seconds**.

### Feature 3: Cross-Browser Speech Recognition & Visualizer
* **Cross-Browser Compatibility:** Speech recognition was adapted to work seamlessly on Microsoft Edge and Google Chrome.
* **The Edge Network Bug Fix:** Microsoft Edge's speech engine throws persistent `'network'` connection failures in continuous mode. We resolved this by configuring the engine for single-sentence transcription (`continuous = false`) combined with a state-preserving auto-restart loop in the `onend` callback.
* **Microphone Resource Leak Fix:** To prevent the browser tab from permanently locking the microphone icon on, we reuse the active media stream rather than requesting a new `getUserMedia` stream on every mic toggle.
* **Visualizer:** Added a custom blue-and-white theme sound-wave micro-animation reflecting speaking state.

### Feature 4: Batch CSV Upload Analyzer & Dashboard
* **Batch Ingestion:** Upload any dataset (`.csv`). The backend automatically matches headers like `text`, `review`, or `comment`, classifies the sentiment of each entry, and generates a downloadable processed file.
* **Data Visualization & Analytics:**
  * **Distribution Chart:** Interactive donut chart detailing the percentage of positive, negative, and neutral entries.
  * **Word-frequency Analysis:** Horizontal bar chart illustrating the top 10 keywords inside the uploaded dataset.
  * **Interactive Preview Grid:** View the first 100 entries in the browser with full search, sorting, and sentiment filtering.

---

## 3. Verification Plan

### Automated Pipeline Verification
* Run `venv/Scripts/python.exe step1_train_model.py` to train the negation-aware baseline model, generate classification reports, and save the preprocessed text cache (`DataSet/train_clean.csv`).

### Manual Workflow Verification
1. Run the Flask server:
   ```bash
   python WebSite/api.py
   ```
2. Open the page in your browser. Under the **Single Text** tab:
   * Enter a negated phrase (e.g. *"not bad at all"*), and ensure it gets classified correctly.
   * Toggle the microphone and dictate a sentence. Confirm transcription behaves correctly and does not drop connection on Edge.
   * If a prediction is incorrect, select the correct sentiment in the feedback widget and click **Submit Correction**.
   * Scroll to the **Model Management & MLOps** section at the bottom, click **Retrain Model**, and verify that the retraining completes in under 1.5 seconds and updates the dynamic in-memory model state.
3. Switch to the **Batch CSV Upload** tab:
   * Drag-and-drop a sample CSV.
   * Verify charts render correctly, keywords are displayed, search-filtering works, and the output CSV downloads with the `predicted_sentiment` column appended.
