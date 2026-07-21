from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import pickle
import re
import string
import nltk
import os
import uuid
import pandas as pd
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.stem import WordNetLemmatizer
from nltk.sentiment.vader import SentimentIntensityAnalyzer

# Download required NLTK resources quietly
nltk.download('punkt', quiet=True)
nltk.download('stopwords', quiet=True)
nltk.download('wordnet', quiet=True)
nltk.download('vader_lexicon', quiet=True)
nltk.download('averaged_perceptron_tagger', quiet=True)
nltk.download('averaged_perceptron_tagger_eng', quiet=True)

# Global preprocessing assets initialized once to maximize speed
negation_words = {'not', 'no', 'never', 'neither', 'nor', 'but', 'without', 'only'}
stop_words_global = set(stopwords.words('english')) - negation_words
lemmatizer_global = WordNetLemmatizer()

app = Flask(__name__, static_folder='.')
CORS(app)

# Load the model and coefficients
model = None
word_weights = {}
current_accuracy = 0.6945 # Baseline accuracy from negation-aware model training
import json

try:
    # Load persisted model metadata if available
    metadata_path = 'Model/model_metadata.json'
    if os.path.exists(metadata_path):
        try:
            with open(metadata_path, 'r') as mf:
                meta = json.load(mf)
                current_accuracy = meta.get('accuracy', 0.6945)
        except Exception as e_meta:
            print(f"Error loading model metadata: {e_meta}")
    with open('Model/sentiment_analysis_model.pkl', 'rb') as file:
        model = pickle.load(file)
    
    # Extract coefficients for word-level highlights
    if model is not None:
        tfidf = model.named_steps['tfidf']
        clf = model.named_steps['clf']
        vocab = tfidf.vocabulary_
        classes = list(clf.classes_)
        
        # Check coefficients shape
        # Typically ['negative', 'neutral', 'positive']
        pos_idx = classes.index('positive') if 'positive' in classes else -1
        neg_idx = classes.index('negative') if 'negative' in classes else -1
        
        if len(clf.coef_) >= 3 and pos_idx != -1 and neg_idx != -1:
            for word, idx in vocab.items():
                # Score = positive coefficient - negative coefficient
                word_weights[word] = float(clf.coef_[pos_idx][idx] - clf.coef_[neg_idx][idx])
        elif len(clf.coef_) == 1:
            # Binary classification case
            for word, idx in vocab.items():
                word_weights[word] = float(clf.coef_[0][idx])
except Exception as e:
    print(f"Error loading model or feature weights: {str(e)}")

# Initialize VADER lexicon analyzer
try:
    vader_analyzer = SentimentIntensityAnalyzer()
except Exception as e:
    print(f"Error loading VADER Lexicon: {str(e)}")
    vader_analyzer = None

def clean_text(text):
    """
    Clean and preprocess text data
    """
    if not isinstance(text, str):
        return ""
        
    # Convert to lowercase
    text = text.lower()
    
    # Remove URLs
    text = re.sub(r'https?://\S+|www\.\S+', '', text)
    
    # Remove HTML tags
    text = re.sub(r'<.*?>', '', text)
    
    # Remove user mentions
    text = re.sub(r'@\w+', '', text)
    
    # Remove hashtags (keeping the text after #)
    text = re.sub(r'#(\w+)', r'\1', text)
    
    # Remove punctuation
    text = text.translate(str.maketrans('', '', string.punctuation))
    
    # Remove numbers
    text = re.sub(r'\d+', '', text)
    
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

def preprocess_text(text):
    """
    Full preprocessing pipeline: clean, tokenize, remove stopwords, and lemmatize
    """
    if not isinstance(text, str):
        return ""
        
    # Clean text
    text = clean_text(text)
    
    # Tokenize
    tokens = word_tokenize(text)
    
    # Remove stopwords (using fast global cached set)
    tokens = [token for token in tokens if token not in stop_words_global]
    
    # Lemmatize (using fast global cached class)
    tokens = [lemmatizer_global.lemmatize(token) for token in tokens]
    
    # Join tokens back into text
    processed_text = ' '.join(tokens)
    
    return processed_text

def get_text_word_weights(text, engine="ml"):
    """
    Get weights for each word token in the input text.
    For ML: looks up unigrams in our precomputed weights.
    For VADER: uses vader_analyzer.lexicon directly.
    """
    if not text or not isinstance(text, str):
        return []
        
    try:
        tokens = word_tokenize(text)
    except:
        tokens = text.split()
        
    results = []
    
    if engine == "lexicon" and vader_analyzer:
        # VADER lexicon scoring
        for token in tokens:
            lower_token = token.lower()
            score = 0.0
            if lower_token in vader_analyzer.lexicon:
                score = float(vader_analyzer.lexicon[lower_token])
            results.append({
                'word': token,
                'score': score
            })
    else:
        # Machine learning scoring (unigrams)
        lemmatizer = WordNetLemmatizer()
        for token in tokens:
            lower_token = token.lower()
            lemmatized = lemmatizer.lemmatize(lower_token)
            
            score = 0.0
            if lower_token in word_weights:
                score = word_weights[lower_token]
            elif lemmatized in word_weights:
                score = word_weights[lemmatized]
                
            results.append({
                'word': token,
                'score': score
            })
            
    return results

def extract_aspects_sentiment(text, engine="ml"):
    """
    Extract aspects (nouns) from text and compute sentiment for each using a surrounding context window.
    """
    aspects_found = []
    if not text or not isinstance(text, str):
        return aspects_found
        
    try:
        # Split into sentences
        sentences = sent_tokenize(text)
        stop_words = stop_words_global
        
        for sentence in sentences:
            tokens = word_tokenize(sentence)
            if not tokens:
                continue
            tagged = nltk.pos_tag(tokens)
            
            for i, (word, tag) in enumerate(tagged):
                # Target nouns as candidate aspects
                if tag in ['NN', 'NNS', 'NNP', 'NNPS']:
                    aspect_clean = word.lower().strip(string.punctuation)
                    if len(aspect_clean) < 2 or aspect_clean in stop_words:
                        continue
                        
                    # Context window of 5 words around the noun
                    start_idx = max(0, i - 5)
                    end_idx = min(len(tokens), i + 6)
                    context_tokens = tokens[start_idx:end_idx]
                    context_text = " ".join(context_tokens)
                    
                    sentiment = "neutral"
                    score = 0.0
                    
                    if engine == "lexicon" and vader_analyzer:
                        scores = vader_analyzer.polarity_scores(context_text)
                        compound = scores['compound']
                        score = float(compound)
                        if compound >= 0.05:
                            sentiment = "positive"
                        elif compound <= -0.05:
                            sentiment = "negative"
                    elif model:
                        cleaned_context = preprocess_text(context_text)
                        if cleaned_context:
                            pred = model.predict([cleaned_context])[0]
                            sentiment = pred
                            try:
                                probs = model.predict_proba([cleaned_context])[0]
                                classes = list(model.named_steps['clf'].classes_)
                                score = float(probs[classes.index(pred)])
                            except:
                                score = 1.0
                                
                    aspects_found.append({
                        'aspect': word,  # Keep original capitalization
                        'sentiment': sentiment,
                        'score': round(score, 2)
                    })
    except Exception as e:
        print(f"Error in aspect extraction: {str(e)}")
        
    # Deduplicate aspects
    seen = set()
    unique_aspects = []
    for item in aspects_found:
        key = item['aspect'].lower()
        if key not in seen:
            seen.add(key)
            unique_aspects.append(item)
            
    return unique_aspects

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        data = request.get_json() or {}
        text = data.get('text', '')
        engine = data.get('engine', 'ml')  # 'ml' or 'lexicon'
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
            
        sentiment = "neutral"
        
        if engine == "lexicon" and vader_analyzer:
            scores = vader_analyzer.polarity_scores(text)
            compound = scores['compound']
            if compound >= 0.05:
                sentiment = "positive"
            elif compound <= -0.05:
                sentiment = "negative"
            else:
                sentiment = "neutral"
        else:
            if model is None:
                # Fallback to lexicon if ML model isn't available
                if vader_analyzer:
                    scores = vader_analyzer.polarity_scores(text)
                    compound = scores['compound']
                    if compound >= 0.05:
                        sentiment = "positive"
                    elif compound <= -0.05:
                        sentiment = "negative"
                    else:
                        sentiment = "neutral"
                    engine = "lexicon"
                else:
                    return jsonify({'error': 'No analysis model available'}), 500
            else:
                processed_text = preprocess_text(text)
                if processed_text:
                    sentiment = model.predict([processed_text])[0]
                else:
                    sentiment = "neutral"
                
        # Word weights & aspects
        word_w = get_text_word_weights(text, engine)
        aspects = extract_aspects_sentiment(text, engine)
        processed = preprocess_text(text)
        
        return jsonify({
            'sentiment': sentiment,
            'processed_text': processed,
            'word_weights': word_w,
            'aspects': aspects
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/analyze_batch', methods=['POST'])
def analyze_batch():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
        
    file = request.files['file']
    engine = request.form.get('engine', 'ml')
    
    if file.filename == '':
        return jsonify({'error': 'Empty filename'}), 400
        
    try:
        filename = file.filename.lower()
        ROW_LIMIT = 1_000  # Safe for Render free tier (512MB RAM, 30s timeout)

        if filename.endswith('.txt'):
            # --- Stream .txt line-by-line (never loads full file into RAM) ---
            import io as _io
            stream = _io.TextIOWrapper(file.stream, encoding='utf-8', errors='replace')
            lines = []
            original_row_count = 0
            first_line = None
            for raw_line in stream:
                stripped = raw_line.rstrip('\n\r').strip()
                if not stripped:
                    continue
                if first_line is None:
                    first_line = stripped
                if len(lines) < ROW_LIMIT:
                    lines.append(stripped)
                else:
                    # File has more rows than limit — stop immediately, don't read the rest
                    original_row_count = f'{ROW_LIMIT}+'
                    break
            if not isinstance(original_row_count, str):
                original_row_count = len(lines)

            if not lines:
                return jsonify({'error': 'Empty text file'}), 400

            # Detect format from first non-empty line
            if first_line and first_line.startswith('__label__'):
                texts = []
                for line in lines:
                    parts = line.split(' ', 1)
                    texts.append(parts[1] if len(parts) > 1 else '')
                df = pd.DataFrame({'text': texts})
            elif first_line and '\t' in first_line:
                import io as _io2
                df = pd.read_csv(_io2.StringIO('\n'.join(lines)), sep='\t', on_bad_lines='skip')
            else:
                df = pd.DataFrame({'text': lines})
            # --- End .txt streaming parser ---
        else:
            # For CSV: only read ROW_LIMIT rows — never loads full file
            df = pd.read_csv(file, nrows=ROW_LIMIT + 1)  # +1 to detect truncation
            original_row_count = None  # unknown without reading full file

        if len(df) == 0:
            return jsonify({'error': 'Empty file'}), 400

        # Cap and track truncation
        truncated_to = None
        if filename.endswith('.txt'):
            # original_row_count is either an int (exact) or a string like '1000+' (truncated)
            if isinstance(original_row_count, str) or original_row_count > ROW_LIMIT:
                truncated_to = ROW_LIMIT
        else:
            # For CSV: if we got ROW_LIMIT+1 rows, file has more
            original_row_count = len(df)
            if len(df) > ROW_LIMIT:
                df = df.head(ROW_LIMIT)
                truncated_to = ROW_LIMIT
                original_row_count = f'{ROW_LIMIT}+'



        # Find the text column (first check exact, then check substring matches, skipping metadata)
        text_column = None
        for col in df.columns:
            col_lower = col.lower()
            if any(ex in col_lower for ex in ['id', 'name', 'date', 'time', 'rating', 'score', 'num']):
                continue
            if col_lower in ['text', 'review', 'comment', 'message', 'tweet', 'feedback']:
                text_column = col
                break
                
        if text_column is None:
            for col in df.columns:
                col_lower = col.lower()
                if any(ex in col_lower for ex in ['id', 'name', 'date', 'time', 'rating', 'score', 'num']):
                    continue
                if any(keyword in col_lower for keyword in ['text', 'review', 'comment', 'message', 'tweet', 'feedback']):
                    text_column = col
                    break
                    
        if text_column is None:
            # Fallback to the first column
            text_column = df.columns[0]

        # --- Data Quality Heuristic ---
        # Sample up to 20 non-null values from the detected text column and
        # check whether they look like natural language or numeric/timestamp data.
        import re as _re
        _sample = df[text_column].dropna().astype(str).head(20).tolist()
        _numeric_or_date_count = 0
        _timestamp_pattern = _re.compile(
            r'^\d{4}[-/]\d{2}[-/]\d{2}|^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}'
        )
        for _val in _sample:
            _stripped = _val.strip()
            # Check: pure number (int or float)
            try:
                float(_stripped)
                _numeric_or_date_count += 1
                continue
            except ValueError:
                pass
            # Check: looks like a timestamp / date string
            if _timestamp_pattern.match(_stripped):
                _numeric_or_date_count += 1
                continue
            # Check: very short (1-3 chars) — likely an ID or code
            if len(_stripped) <= 3:
                _numeric_or_date_count += 1
                continue
            # Check: contains only digits and common separators (e.g. "2.02E+10")
            if _re.fullmatch(r'[\d.,eE+\-\s]+', _stripped):
                _numeric_or_date_count += 1

        _column_warning = False
        _column_warning_message = ""
        if len(_sample) > 0 and (_numeric_or_date_count / len(_sample)) >= 0.6:
            _column_warning = True
            _column_warning_message = (
                f"The detected text column \u2018{text_column}\u2019 appears to contain "
                "numeric, date, or ID values rather than natural language text. "
                "Sentiment analysis is designed for opinion-bearing text such as "
                "customer reviews, feedback, or social media posts. Results may not "
                "be meaningful for this dataset."
            )
        # --- End Data Quality Heuristic ---

        sentiments = []
        for idx, row in df.iterrows():
            row_text = str(row[text_column]) if pd.notnull(row[text_column]) else ""
            
            sentiment = "neutral"
            if row_text:
                if engine == "lexicon" and vader_analyzer:
                    scores = vader_analyzer.polarity_scores(row_text)
                    compound = scores['compound']
                    if compound >= 0.05:
                        sentiment = "positive"
                    elif compound <= -0.05:
                        sentiment = "negative"
                    else:
                        sentiment = "neutral"
                elif model:
                    processed_text = preprocess_text(row_text)
                    if processed_text:
                        sentiment = model.predict([processed_text])[0]
            sentiments.append(sentiment)
            
        df['predicted_sentiment'] = sentiments
        
        # Calculate statistics
        total_rows = len(df)
        counts = df['predicted_sentiment'].value_counts()
        pos_count = int(counts.get('positive', 0))
        neg_count = int(counts.get('negative', 0))
        neu_count = int(counts.get('neutral', 0))
        
        # Get most common terms
        all_words = []
        stop_words = set(stopwords.words('english'))
        _word_re = __import__('re').compile(r"[a-z']{3,}")
        for text_val in df[text_column].dropna():
            for w in _word_re.findall(str(text_val).lower()):
                if w not in stop_words:
                    all_words.append(w)

        from collections import Counter
        word_counts = Counter(all_words).most_common(10)
        top_words = [{'word': w, 'count': c} for w, c in word_counts]
        
        # Save output inside static temp folder
        temp_dir = os.path.join(app.static_folder, 'temp_batches')
        os.makedirs(temp_dir, exist_ok=True)
        
        batch_id = str(uuid.uuid4())
        filename = f"result_{batch_id}.csv"
        filepath = os.path.join(temp_dir, filename)
        df.to_csv(filepath, index=False)
        
        # Return first 100 rows for preview
        preview_rows = df.head(100).to_dict(orient='records')
        
        return jsonify({
            'total_rows': total_rows,
            'pos_count': pos_count,
            'neg_count': neg_count,
            'neu_count': neu_count,
            'top_words': top_words,
            'download_url': f"/temp_batches/{filename}",
            'preview_data': preview_rows,
            'text_column': text_column,
            'column_warning': _column_warning,
            'column_warning_message': _column_warning_message,
            'truncated_to': truncated_to,
            'original_row_count': original_row_count
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/feedback', methods=['POST'])
def save_feedback():
    try:
        data = request.json or {}
        text = data.get('text', '').strip()
        correct_sentiment = data.get('correct_sentiment', '').strip()
        
        if not text or not correct_sentiment:
            return jsonify({'error': 'Missing text or correct_sentiment in request'}), 400
            
        feedback_file = 'DataSet/feedback.csv'
        os.makedirs('DataSet', exist_ok=True)
        
        # Load existing feedback if any
        if os.path.exists(feedback_file):
            df_feed = pd.read_csv(feedback_file)
            
            # Check if this exact text already exists (case-insensitive and whitespace-stripped match)
            df_feed['text_clean'] = df_feed['text'].str.strip().str.lower()
            clean_text_input = text.strip().lower()
            
            match_idx = df_feed[df_feed['text_clean'] == clean_text_input].index
            if len(match_idx) > 0:
                # Overwrite the sentiment for the existing entry
                df_feed.loc[match_idx, 'sentiment'] = correct_sentiment
                df_feed = df_feed.drop(columns=['text_clean'])
                df_feed.to_csv(feedback_file, index=False)
            else:
                # Append new correction
                df_feed = df_feed.drop(columns=['text_clean'])
                new_row = pd.DataFrame([{'text': text, 'sentiment': correct_sentiment}])
                df_feed = pd.concat([df_feed, new_row], ignore_index=True)
                df_feed.to_csv(feedback_file, index=False)
        else:
            # Create new file
            df_feed = pd.DataFrame([{'text': text, 'sentiment': correct_sentiment}])
            df_feed.to_csv(feedback_file, index=False)
            
        # Count total feedbacks
        feedback_count = len(df_feed)
        
        return jsonify({
            'status': 'success',
            'message': 'Feedback correction logged successfully!',
            'feedback_count': feedback_count
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/model_stats', methods=['GET'])
def get_model_stats():
    try:
        feedback_file = 'DataSet/feedback.csv'
        feedback_count = 0
        if os.path.exists(feedback_file):
            df_feed = pd.read_csv(feedback_file)
            feedback_count = len(df_feed)
            
        global current_accuracy
        
        history = []
        history_file = 'Model/retrain_history.json'
        if os.path.exists(history_file):
            try:
                with open(history_file, 'r') as hf:
                    history = json.load(hf)
            except Exception as e_hist:
                print(f"Error loading history: {e_hist}")
                
        if not history:
            # Generate default baseline history if it doesn't exist
            history = [{
                'timestamp': 'Baseline Run',
                'accuracy': '69.45%',
                'samples_trained': 27480,
                'feedback_count': 0
            }]
            
        response = jsonify({
            'accuracy': f"{current_accuracy * 100:.2f}%",
            'feedback_count': feedback_count,
            'history': history
        })
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/reset_model', methods=['POST'])
def reset_model():
    try:
        global model, word_weights, current_accuracy
        
        # 1. Delete feedback logs
        feedback_file = 'DataSet/feedback.csv'
        if os.path.exists(feedback_file):
            os.remove(feedback_file)
            
        # 2. Delete model metadata and history files
        metadata_file = 'Model/model_metadata.json'
        if os.path.exists(metadata_file):
            os.remove(metadata_file)
            
        history_file = 'Model/retrain_history.json'
        if os.path.exists(history_file):
            os.remove(history_file)
            
        # 3. Retrain model back to clean baseline state
        clean_train_file = 'DataSet/train_clean.csv'
        train_file = 'DataSet/train.csv'
        
        if os.path.exists(clean_train_file):
            df_train = pd.read_csv(clean_train_file)[['clean_text', 'sentiment']]
            df_train['clean_text'] = df_train['clean_text'].fillna("")
            df_train = df_train.dropna(subset=['sentiment'])
        elif os.path.exists(train_file):
            df_raw = pd.read_csv(train_file, encoding='latin-1')[['text', 'sentiment']].dropna()
            df_raw = df_raw[df_raw['sentiment'].isin(['positive', 'negative', 'neutral'])]
            df_raw['clean_text'] = df_raw['text'].apply(preprocess_text)
            df_train = df_raw[['clean_text', 'sentiment']]
            df_train.to_csv(clean_train_file, index=False)
        else:
            return jsonify({'error': 'Train dataset not found.'}), 400
            
        # Refit Logistic Regression pipeline on pure baseline data
        from sklearn.pipeline import Pipeline
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.linear_model import LogisticRegression
        
        baseline_pipeline = Pipeline([
            ('tfidf', TfidfVectorizer(max_features=10000, ngram_range=(1, 2))),
            ('clf', LogisticRegression(max_iter=1000, random_state=42))
        ])
        baseline_pipeline.fit(df_train['clean_text'], df_train['sentiment'])
        
        # Overwrite pickled model file on disk
        os.makedirs('Model', exist_ok=True)
        with open('Model/sentiment_analysis_model.pkl', 'wb') as file:
            pickle.dump(baseline_pipeline, file)
            
        # Hot-swap model and reset stats in-memory
        model = baseline_pipeline
        current_accuracy = 0.6945
        
        # Reset word weights
        word_weights.clear()
        tfidf = model.named_steps['tfidf']
        clf = model.named_steps['clf']
        vocab = tfidf.vocabulary_
        classes = list(clf.classes_)
        pos_idx = classes.index('positive') if 'positive' in classes else -1
        neg_idx = classes.index('negative') if 'negative' in classes else -1
        
        if len(clf.coef_) >= 3 and pos_idx != -1 and neg_idx != -1:
            for word, idx in vocab.items():
                word_weights[word] = float(clf.coef_[pos_idx][idx] - clf.coef_[neg_idx][idx])
        elif len(clf.coef_) == 1:
            for word, idx in vocab.items():
                word_weights[word] = float(clf.coef_[0][idx])
                
        # Generate clean baseline history
        history = [{
            'timestamp': 'Baseline Run',
            'accuracy': '69.45%',
            'samples_trained': len(df_train),
            'feedback_count': 0
        }]
        
        return jsonify({
            'status': 'success',
            'message': 'Model reset to baseline state successfully!',
            'accuracy': '69.45%',
            'feedback_count': 0,
            'history': history
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/retrain', methods=['POST'])
def retrain_model():
    try:
        global model, word_weights, current_accuracy
        
        # Load train dataset from cache if available for ultra-fast retraining
        clean_train_file = 'DataSet/train_clean.csv'
        train_file = 'DataSet/train.csv'
        
        if os.path.exists(clean_train_file):
            df_train = pd.read_csv(clean_train_file)[['clean_text', 'sentiment']]
            df_train['clean_text'] = df_train['clean_text'].fillna("")
            df_train = df_train.dropna(subset=['sentiment'])
        elif os.path.exists(train_file):
            print("Clean cache not found, preprocessing train.csv in real-time...")
            df_raw = pd.read_csv(train_file, encoding='latin-1')[['text', 'sentiment']].dropna()
            df_raw = df_raw[df_raw['sentiment'].isin(['positive', 'negative', 'neutral'])]
            df_raw['clean_text'] = df_raw['text'].apply(preprocess_text)
            df_train = df_raw[['clean_text', 'sentiment']]
            # Save cache for next time
            df_train.to_csv(clean_train_file, index=False)
        else:
            return jsonify({'error': 'Train dataset train.csv not found in DataSet folder.'}), 400
            
        baseline_size = len(df_train)
            
        # Merge feedback if any
        feedback_file = 'DataSet/feedback.csv'
        feedback_count = 0
        if os.path.exists(feedback_file):
            df_feed = pd.read_csv(feedback_file)[['text', 'sentiment']].dropna()
            df_feed = df_feed[df_feed['sentiment'].isin(['positive', 'negative', 'neutral'])]
            feedback_count = len(df_feed)
            if feedback_count > 0:
                # Preprocess ONLY the feedback texts (super fast!)
                df_feed['clean_text'] = df_feed['text'].apply(preprocess_text)
                df_train = pd.concat([df_train, df_feed[['clean_text', 'sentiment']]], ignore_index=True)
                
        # Ensure text column is clean string format
        df_train['clean_text'] = df_train['clean_text'].astype(str)
        
        # Fit vectorizer and classifier in pipeline
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import accuracy_score
        from sklearn.pipeline import Pipeline
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.linear_model import LogisticRegression
        
        # Perform split to evaluate performance change
        pipeline = Pipeline([
            ('tfidf', TfidfVectorizer(max_features=10000, ngram_range=(1, 2))),
            ('clf', LogisticRegression(max_iter=1000, random_state=42))
        ])
        
        import numpy as np
        
        try:
            X_tr, X_val, y_tr, y_val = train_test_split(
                df_train['clean_text'], df_train['sentiment'], test_size=0.2, random_state=42, stratify=df_train['sentiment']
            )
            
            # Map index of split back to original df_train to assign sample weights
            sample_weights_tr = np.ones(len(X_tr))
            for idx, orig_idx in enumerate(X_tr.index):
                if orig_idx >= baseline_size:
                    sample_weights_tr[idx] = 20.0
                    
            pipeline.fit(X_tr, y_tr, clf__sample_weight=sample_weights_tr)
            y_pred = pipeline.predict(X_val)
            val_acc = float(accuracy_score(y_val, y_pred))
        except Exception as split_err:
            print(f"Stratification failed or split error: {str(split_err)}, falling back to full fit evaluation")
            pipeline.fit(df_train['clean_text'], df_train['sentiment'])
            y_pred = pipeline.predict(df_train['clean_text'])
            val_acc = float(accuracy_score(df_train['sentiment'], y_pred))
            
        # Re-fit final model pipeline on ALL combined data to maximize training data usage
        final_pipeline = Pipeline([
            ('tfidf', TfidfVectorizer(max_features=10000, ngram_range=(1, 2))),
            ('clf', LogisticRegression(max_iter=1000, random_state=42))
        ])
        
        # Calculate sample weights for the entire combined dataset
        sample_weights_all = np.ones(len(df_train))
        if len(df_train) > baseline_size:
            sample_weights_all[baseline_size:] = 20.0
            
        final_pipeline.fit(df_train['clean_text'], df_train['sentiment'], clf__sample_weight=sample_weights_all)
        
        # Save model to disk
        os.makedirs('Model', exist_ok=True)
        with open('Model/sentiment_analysis_model.pkl', 'wb') as file:
            pickle.dump(final_pipeline, file)
            
        # Save metadata to disk to persist accuracy across server restarts
        try:
            with open('Model/model_metadata.json', 'w') as mf:
                json.dump({
                    'accuracy': val_acc,
                    'samples_trained': len(df_train)
                }, mf)
        except Exception as e_meta:
            print(f"Error saving model metadata: {e_meta}")
            
        # Update retraining history log file
        history_file = 'Model/retrain_history.json'
        history = []
        if os.path.exists(history_file):
            try:
                with open(history_file, 'r') as hf:
                    history = json.load(hf)
            except Exception as e_hist:
                print(f"Error loading history: {e_hist}")
                
        if not history:
            history.append({
                'timestamp': 'Baseline Run',
                'accuracy': '69.45%',
                'samples_trained': 27480,
                'feedback_count': 0
            })
            
        import datetime
        new_entry = {
            'timestamp': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'accuracy': f"{val_acc * 100:.2f}%",
            'samples_trained': len(df_train),
            'feedback_count': feedback_count
        }
        # Avoid logging identical duplicate run entries at the same timestamp
        if not (history and history[-1]['accuracy'] == new_entry['accuracy'] and history[-1]['feedback_count'] == new_entry['feedback_count'] and history[-1]['timestamp'] == new_entry['timestamp']):
            history.append(new_entry)
            
        try:
            with open(history_file, 'w') as hf:
                json.dump(history, hf)
        except Exception as e_hist:
            print(f"Error saving history: {e_hist}")
            
        # Update running in-memory model and coefficients
        model = final_pipeline
        current_accuracy = val_acc
        
        # Refresh weights coefficients
        word_weights.clear()
        tfidf = model.named_steps['tfidf']
        clf = model.named_steps['clf']
        vocab = tfidf.vocabulary_
        classes = list(clf.classes_)
        
        pos_idx = classes.index('positive') if 'positive' in classes else -1
        neg_idx = classes.index('negative') if 'negative' in classes else -1
        
        if len(clf.coef_) >= 3 and pos_idx != -1 and neg_idx != -1:
            for word, idx in vocab.items():
                word_weights[word] = float(clf.coef_[pos_idx][idx] - clf.coef_[neg_idx][idx])
        elif len(clf.coef_) == 1:
            for word, idx in vocab.items():
                word_weights[word] = float(clf.coef_[0][idx])
                
        return jsonify({
            'status': 'success',
            'message': 'Model retrained and updated in-memory successfully!',
            'accuracy': f"{val_acc * 100:.2f}%",
            'samples_trained': len(df_train),
            'feedback_count': feedback_count,
            'history': history
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', debug=True, port=port)