document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------
    // Custom Toast Notification System
    // ----------------------------------------------------
    const toastContainer = document.getElementById('toastContainer');
    
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let iconClass = 'fa-info-circle';
        if (type === 'success') iconClass = 'fa-check-circle';
        else if (type === 'error') iconClass = 'fa-exclamation-circle';
        else if (type === 'warning') iconClass = 'fa-exclamation-triangle';
        
        const escapedMessage = message
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
            
        toast.innerHTML = `<i class="fas ${iconClass}"></i> <span>${escapedMessage}</span>`;
        if (toastContainer) {
            toastContainer.appendChild(toast);
        } else {
            document.body.appendChild(toast);
        }
        
        setTimeout(() => toast.classList.add('show'), 50);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ----------------------------------------------------
    // Tab System Configuration
    // ----------------------------------------------------
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;

            // Update active button state
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Update active content panel
            tabContents.forEach(content => {
                if (content.id === targetTab) {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });
        });
    });

    // ----------------------------------------------------
    // Speech Recognition Configuration (Voice Dictation)
    // ----------------------------------------------------
    const textInput = document.getElementById('textInput');
    const micBtn = document.getElementById('micBtn');
    const voiceOverlay = document.getElementById('voiceOverlay');
    const voiceTimer = document.getElementById('voiceTimer');
    const voiceCancelBtn = document.getElementById('voiceCancelBtn');
    const voicePauseBtn = document.getElementById('voicePauseBtn');
    const voiceStopBtn = document.getElementById('voiceStopBtn');
    
    // Check speech recognition availability
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let isListening = false;
    let isPaused = false;
    let isStoppingExplicitly = false;
    let isCancelled = false;
    let savedTextBeforeRecording = '';
    let finalTranscript = '';
    
    // Web Audio Visualizer Variables
    let audioContext = null;
    let analyser = null;
    let dataArray = null;
    let sourceNode = null;
    let audioStream = null;
    let timerInterval = null;
    let timerSeconds = 0;

    // Helper to start the Web Audio visualizer from microphone stream
    async function startAudioVisualizer() {
        if (audioStream && audioContext) {
            // Already active and configured, just run drawVisualizer and return
            drawVisualizer();
            return;
        }
        try {
            audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 64; // returns 32 data bins
            
            sourceNode = audioContext.createMediaStreamSource(audioStream);
            sourceNode.connect(analyser);
            
            const bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
            
            drawVisualizer();
        } catch (err) {
            console.error('Error starting audio visualizer:', err);
            showToast('Microphone access denied or not available. Please allow mic permissions in your browser.', 'error');
            if (isListening) {
                isCancelled = true;
                recognition.abort();
            }
        }
    }

    // Helper to draw the real-time audio waves
    function drawVisualizer() {
        if (!isListening || isPaused || !analyser) return;
        requestAnimationFrame(drawVisualizer);
        
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate energy from human voice frequency range (index 0 to 8)
        let totalEnergy = 0;
        for (let i = 0; i < 8; i++) {
            totalEnergy += dataArray[i] || 0;
        }
        const averageVolume = totalEnergy / 8; // 0 to 255
        
        const bars = document.querySelectorAll('.wave-bar');
        
        bars.forEach((bar, index) => {
            // Symmetric wave factor (highest at center, lowest at edges)
            const centerDist = Math.abs(index - 14.5);
            const centerFactor = Math.max(0, 1 - (centerDist / 15));
            
            // Map the 30 bars to the first 12 bins
            let binIndex = Math.floor(centerDist) % 12;
            let rawValue = dataArray[binIndex] || 0;
            
            // Mix raw value and average volume
            let value = (rawValue * 0.6 + averageVolume * 0.4) * centerFactor;
            
            // Add a tiny variance so it looks fluid
            if (value > 10) {
                value += (Math.random() - 0.5) * 15;
            }
            
            const height = Math.max(4, (value / 255) * 35);
            bar.style.height = `${height}px`;
            
            if (height > 4.5) {
                bar.style.borderRadius = '2px';
                bar.style.backgroundColor = 'var(--primary-color)';
            } else {
                bar.style.borderRadius = '50%';
                bar.style.backgroundColor = 'rgba(74, 144, 226, 0.2)';
            }
        });
    }

    // Helper to draw flat visualizer dots when paused or muted
    function drawFlatVisualizer() {
        const bars = document.querySelectorAll('.wave-bar');
        bars.forEach(bar => {
            bar.style.height = '4px';
            bar.style.borderRadius = '50%';
            bar.style.backgroundColor = 'rgba(74, 144, 226, 0.2)';
        });
    }

    // Helper to stop the visualizer and release mic tracks
    function stopAudioVisualizer() {
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            audioStream = null;
        }
        if (audioContext) {
            audioContext.close().catch(() => {});
            audioContext = null;
        }
        analyser = null;
    }

    // Helper to handle timer start
    function startTimer() {
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            timerSeconds++;
            const mins = Math.floor(timerSeconds / 60);
            const secs = timerSeconds % 60;
            if (voiceTimer) {
                voiceTimer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }

    // Helper to handle timer stop
    function stopTimer() {
        clearInterval(timerInterval);
    }

    if (SpeechRecognition) {
        const isEdge = navigator.userAgent.indexOf('Edg/') !== -1;
        recognition = new SpeechRecognition();
        recognition.continuous = !isEdge; // False on Edge to prevent Microsoft Speech Server network errors, true on Chrome
        recognition.interimResults = true;
        recognition.lang = navigator.language || 'en-US';

        recognition.onstart = () => {
            isListening = true;
            micBtn.classList.add('active');
            micBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';
            textInput.placeholder = "Listening... Speak now...";
            
            // Show Overlay
            if (voiceOverlay) {
                voiceOverlay.style.display = 'flex';
            }

            // Set overlay controls
            if (voicePauseBtn) {
                voicePauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
                voicePauseBtn.title = "Pause Recording";
                voicePauseBtn.className = "voice-action-btn pause-btn";
            }
            
            // Start Visualizer
            startAudioVisualizer();
            
            // Start Timer
            timerSeconds = 0;
            if (voiceTimer) voiceTimer.textContent = '0:00';
            startTimer();
        };

        recognition.onend = () => {
            if (isPaused) {
                console.log('Recognition session ended due to pause. Keeping overlay open.');
                return;
            }
            
            // If ended unexpectedly (e.g. silence timeout or continuous=false boundary)
            if (!isStoppingExplicitly && !isCancelled && isListening) {
                console.log('Recognition ended unexpectedly. Restarting...');
                try {
                    savedTextBeforeRecording = textInput.value;
                    finalTranscript = '';
                    recognition.start();
                } catch (e) {
                    console.error('Error restarting recognition:', e);
                }
                return;
            }
            
            // Final clean up
            isListening = false;
            isPaused = false;
            micBtn.classList.remove('active');
            micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            textInput.placeholder = "Type, paste, or dictate your text here to analyze sentiment...";
            
            if (voiceOverlay) {
                voiceOverlay.style.display = 'none';
            }
            
            stopAudioVisualizer();
            stopTimer();
        };

        recognition.onresult = (event) => {
            if (isCancelled) return;
            
            let interimTranscript = '';
            let tempFinal = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    tempFinal += event.results[i][0].transcript + ' ';
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            
            if (tempFinal) {
                finalTranscript += tempFinal;
            }
            
            const fullTranscript = (finalTranscript + interimTranscript).trim();
            const originalVal = savedTextBeforeRecording.trim();
            
            const newText = originalVal ? (originalVal + ' ' + fullTranscript) : fullTranscript;
            textInput.value = newText;
            updateTextStats(newText);
        };

        recognition.onerror = (event) => {
            console.error('Speech Recognition Error:', event.error);
            
            // If user has already clicked send/cancel or the session is inactive, ignore subsequent errors
            if (!isListening && !isPaused) {
                console.log('Speech recognition error ignored because session is already inactive.');
                return;
            }
            
            if (event.error === 'aborted') {
                console.log('Speech recognition aborted by user.');
                return;
            }
            
            if (event.error === 'no-speech') {
                console.log('No speech detected for a moment, keeping session active.');
                return;
            }
            
            isListening = false;
            isPaused = false;
            micBtn.classList.remove('active');
            micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            
            if (voiceOverlay) voiceOverlay.style.display = 'none';
            stopAudioVisualizer();
            stopTimer();
            
            if (event.error === 'not-allowed') {
                showToast('Microphone access blocked or insecure context. Please access via http://localhost:5000 (not 127.0.0.1) and allow mic permissions in your browser.', 'error');
            } else if (event.error === 'network') {
                showToast('Network error in voice dictation. Please check your internet connection.', 'error');
            } else {
                showToast(`Voice recognition error: ${event.error}`, 'error');
            }
        };

        micBtn.addEventListener('click', () => {
            if (isListening) {
                isStoppingExplicitly = true;
                recognition.stop();
            } else {
                savedTextBeforeRecording = textInput.value;
                finalTranscript = '';
                isListening = true;
                isPaused = false;
                isStoppingExplicitly = false;
                isCancelled = false;
                
                recognition.start();
            }
        });

        // Cancel button click (Trash icon)
        if (voiceCancelBtn) {
            voiceCancelBtn.addEventListener('click', () => {
                isCancelled = true;
                isListening = false;
                isPaused = false;
                
                if (recognition) {
                    recognition.abort();
                }
                
                textInput.value = savedTextBeforeRecording;
                updateTextStats(savedTextBeforeRecording);
                
                if (voiceOverlay) {
                    voiceOverlay.style.display = 'none';
                }
                
                stopAudioVisualizer();
                stopTimer();
                micBtn.classList.remove('active');
                micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
                textInput.placeholder = "Type, paste, or dictate your text here to analyze sentiment...";
                
                showToast('Recording cancelled and voice transcript discarded.', 'info');
            });
        }

        // Pause/Resume button click
        if (voicePauseBtn) {
            voicePauseBtn.addEventListener('click', () => {
                if (!isListening) return;
                
                if (isPaused) {
                    // Resume
                    isPaused = false;
                    voicePauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
                    voicePauseBtn.title = "Pause Recording";
                    
                    savedTextBeforeRecording = textInput.value;
                    finalTranscript = '';
                    
                    recognition.start();
                    startAudioVisualizer();
                    startTimer();
                } else {
                    // Pause
                    isPaused = true;
                    voicePauseBtn.innerHTML = '<i class="fas fa-play"></i>';
                    voicePauseBtn.title = "Resume Recording";
                    
                    recognition.stop();
                    stopAudioVisualizer();
                    stopTimer();
                    drawFlatVisualizer();
                }
            });
        }

        // Stop/Send button click (Green Paper Plane)
        if (voiceStopBtn) {
            voiceStopBtn.addEventListener('click', () => {
                isStoppingExplicitly = true;
                isListening = false;
                isPaused = false;
                
                if (recognition) {
                    recognition.stop();
                }
                
                if (voiceOverlay) {
                    voiceOverlay.style.display = 'none';
                }
                
                stopAudioVisualizer();
                stopTimer();
                micBtn.classList.remove('active');
                micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
                textInput.placeholder = "Type, paste, or dictate your text here to analyze sentiment...";
                
                showToast('Speech recorded successfully!', 'success');
            });
        }
    } else {
        micBtn.addEventListener('click', () => {
            showToast('Voice dictation is not supported in this browser. Please try using Google Chrome, Microsoft Edge, or Safari.', 'info');
        });
    }

    // ----------------------------------------------------
    // Emoji Picker Integration
    // ----------------------------------------------------
    const emojiBtn = document.getElementById('emojiBtn');
    const emojiPopover = document.getElementById('emojiPopover');
    const emojiItems = document.querySelectorAll('.emoji-item');

    if (emojiBtn && emojiPopover) {
        emojiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = emojiPopover.style.display === 'grid';
            emojiPopover.style.display = isVisible ? 'none' : 'grid';
        });

        // Close picker when clicking anywhere else
        document.addEventListener('click', (e) => {
            if (!emojiPopover.contains(e.target) && e.target !== emojiBtn) {
                emojiPopover.style.display = 'none';
            }
        });

        // Click on emoji item to insert
        emojiItems.forEach(item => {
            item.addEventListener('click', () => {
                const emoji = item.textContent;
                const startPos = textInput.selectionStart;
                const endPos = textInput.selectionEnd;
                const text = textInput.value;

                // Insert emoji at cursor position
                textInput.value = text.substring(0, startPos) + emoji + text.substring(endPos, text.length);
                
                // Put cursor right after the inserted emoji
                const newCursorPos = startPos + emoji.length;
                textInput.setSelectionRange(newCursorPos, newCursorPos);
                textInput.focus();

                emojiPopover.style.display = 'none';
                updateTextStats(textInput.value);
            });
        });
    }

    // ----------------------------------------------------
    // Chart.js Cache Management
    // ----------------------------------------------------
    let singleFreqChartInstance = null;
    let batchDistributionChartInstance = null;
    let batchKeywordsChartInstance = null;

    // Helper to safely destroy a chart
    function destroyChart(chartInstance) {
        if (chartInstance) {
            chartInstance.destroy();
        }
    }

    // Helper to escape HTML characters
    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // ----------------------------------------------------
    // Single Text Analysis Logic
    // ----------------------------------------------------
    const analyzeBtn = document.getElementById('analyzeBtn');
    const engineSelect = document.getElementById('engineSelect');
    const resultSection = document.getElementById('resultSection');
    const sentimentDisplay = document.getElementById('sentimentDisplay');
    const highlightedText = document.getElementById('highlightedText');
    const aspectsDisplay = document.getElementById('aspectsDisplay');
    const processedText = document.getElementById('processedText');
    const exampleButtons = document.querySelectorAll('.example-btn');

    // Function to render explainable highlighted words
    function renderWordHighlights(wordWeights) {
        highlightedText.innerHTML = '';
        if (!wordWeights || wordWeights.length === 0) return;

        wordWeights.forEach(item => {
            const word = item.word;
            const score = item.score;
            
            const span = document.createElement('span');
            span.textContent = word + ' ';
            span.className = 'word-highlight';
            
            // Highlight threshold: positive (> 0.15) and negative (< -0.15)
            if (score > 0.15) {
                span.classList.add('pos-impact');
                span.title = `Positive Influence Score: +${score.toFixed(3)}`;
            } else if (score < -0.15) {
                span.classList.add('neg-impact');
                span.title = `Negative Influence Score: ${score.toFixed(3)}`;
            } else {
                span.title = `Neutral Score: ${score.toFixed(3)}`;
            }
            
            highlightedText.appendChild(span);
        });
    }

    // Function to render aspect-based sentiment tags
    function renderAspects(aspects) {
        aspectsDisplay.innerHTML = '';
        if (!aspects || aspects.length === 0) {
            aspectsDisplay.innerHTML = '<p class="highlight-desc">No clear aspects or noun entities detected in the text context.</p>';
            return;
        }

        aspects.forEach(item => {
            const aspectCard = document.createElement('div');
            aspectCard.className = 'aspect-card';
            
            let colorClass = 'aspect-neu';
            let iconClass = 'fa-meh text-neutral';
            
            if (item.sentiment === 'positive') {
                colorClass = 'aspect-pos';
                iconClass = 'fa-smile text-success';
            } else if (item.sentiment === 'negative') {
                colorClass = 'aspect-neg';
                iconClass = 'fa-frown text-error';
            }
            
            aspectCard.classList.add(colorClass);
            aspectCard.innerHTML = `<i class="fas ${iconClass}"></i> <strong>${escapeHtml(item.aspect)}</strong>: ${item.sentiment} <span style="font-size:0.8rem; color:var(--text-muted);">(${item.score})</span>`;
            aspectsDisplay.appendChild(aspectCard);
        });
    }

    // Function to render word frequency bar chart
    function renderFrequencyChart(text) {
        const words = text.split(' ').filter(w => w.length > 2);
        const freq = {};
        words.forEach(word => {
            freq[word] = (freq[word] || 0) + 1;
        });

        const sorted = Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        const labels = sorted.map(entry => entry[0]);
        const counts = sorted.map(entry => entry[1]);

        destroyChart(singleFreqChartInstance);

        const ctx = document.getElementById('frequencyChart').getContext('2d');
        
        // Hide container if there is no data to show
        if (labels.length === 0) {
            ctx.canvas.style.display = 'none';
            return;
        } else {
            ctx.canvas.style.display = 'block';
        }

        singleFreqChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Word Count',
                    data: counts,
                    backgroundColor: '#4A90E2',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    }

    // Helper to calculate and display text statistics
    function updateTextStats(text) {
        try {
            const words = text.trim().split(/\s+/).filter(w => w.length > 0);
            const wordCount = words.length;
            const charCount = text.length;
            const emojiMatch = text.match(/\p{Emoji_Presentation}/gu);
            const emojiCount = emojiMatch ? emojiMatch.length : 0;
            
            document.getElementById('statWordCount').textContent = wordCount;
            document.getElementById('statCharCount').textContent = charCount;
            document.getElementById('statEmojiCount').textContent = emojiCount;
        } catch (e) {
            console.error('Error calculating text stats:', e);
        }
    }

    // Trigger analysis
    async function performSingleAnalysis(text) {
        if (!text) return;

        // Calculate and display text statistics
        updateTextStats(text);

        try {
            analyzeBtn.disabled = true;
            analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
            
            const engineValue = engineSelect.value;
            
            const response = await fetch('/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text, engine: engineValue })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Network error analyzing sentiment.');
            }

            const data = await response.json();

            // Render sentiment result badge
            sentimentDisplay.className = 'sentiment-display';
            if (data.sentiment === 'positive') {
                sentimentDisplay.classList.add('sentiment-positive');
                sentimentDisplay.innerHTML = '<i class="fas fa-smile"></i> Positive Sentiment';
            } else if (data.sentiment === 'negative') {
                sentimentDisplay.classList.add('sentiment-negative');
                sentimentDisplay.innerHTML = '<i class="fas fa-frown"></i> Negative Sentiment';
            } else {
                sentimentDisplay.classList.add('sentiment-neutral');
                sentimentDisplay.innerHTML = '<i class="fas fa-meh"></i> Neutral Sentiment';
            }

            // Word highlights & aspects
            renderWordHighlights(data.word_weights);
            renderAspects(data.aspects);

            // Debug text
            processedText.textContent = data.processed_text || 'None';

            // Show results section
            resultSection.style.display = 'block';

            // Frequency chart
            renderFrequencyChart(data.processed_text || '');

            // Smooth scroll to result
            resultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        } catch (error) {
            console.error(error);
            sentimentDisplay.className = 'sentiment-display sentiment-error';
            sentimentDisplay.innerHTML = `<i class="fas fa-exclamation-circle"></i> Error: ${error.message}`;
            resultSection.style.display = 'block';
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = '<i class="fas fa-magic"></i> Analyze Sentiment';
        }
    }

    analyzeBtn.addEventListener('click', () => {
        const text = textInput.value.trim();
        if (!text) {
            showToast('Please enter some text to analyze first!', 'warning');
            return;
        }
        performSingleAnalysis(text);
    });

    exampleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            textInput.value = btn.dataset.text;
            performSingleAnalysis(btn.dataset.text);
        });
    });

    // ----------------------------------------------------
    // Batch CSV Upload Logic & Analytics Dashboard
    // ----------------------------------------------------
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const batchEngineSelect = document.getElementById('batchEngineSelect');
    const uploadProgress = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressStatus = document.getElementById('progressStatus');
    const batchResultSection = document.getElementById('batchResultSection');
    
    // Stats elements
    const statTotalRows = document.getElementById('statTotalRows');
    const statPosPercent = document.getElementById('statPosPercent');
    const statNegPercent = document.getElementById('statNegPercent');
    const statNeuPercent = document.getElementById('statNeuPercent');

    // Table elements
    const previewTable = document.getElementById('previewTable');
    const tableHeaderRow = document.getElementById('tableHeaderRow');
    const tableBody = document.getElementById('tableBody');
    const tableSearch = document.getElementById('tableSearch');
    const tableSentimentFilter = document.getElementById('tableSentimentFilter');
    const downloadBtn = document.getElementById('downloadBtn');

    let globalPreviewData = []; // Store batch rows globally for local filter/search
    let globalTextCol = '';

    // Drag-and-drop actions
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.add('active');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.remove('active');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0 && files[0].name.endsWith('.csv')) {
            handleCsvUpload(files[0]);
        } else {
            showToast('Please drop a valid CSV file!', 'warning');
        }
    });

    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            handleCsvUpload(fileInput.files[0]);
        }
    });

    // Handle File Upload and Network Call
    async function handleCsvUpload(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('engine', batchEngineSelect.value);

        try {
            uploadProgress.style.display = 'block';
            progressFill.style.width = '20%';
            progressStatus.textContent = 'Uploading CSV dataset...';
            batchResultSection.style.display = 'none';

            // Simulate progress transition
            setTimeout(() => { progressFill.style.width = '50%'; progressStatus.textContent = 'Processing NLP Sentiment analysis...'; }, 800);

            const response = await fetch('/analyze_batch', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Server error processing file.');
            }

            progressFill.style.width = '90%';
            progressStatus.textContent = 'Finalizing stats dashboard...';

            const data = await response.json();
            progressFill.style.width = '100%';

            setTimeout(() => {
                uploadProgress.style.display = 'none';
                renderBatchDashboard(data);
            }, 500);

        } catch (error) {
            console.error(error);
            progressStatus.textContent = `Error: ${error.message}`;
            progressFill.style.backgroundColor = 'var(--error-color)';
        }
    }

    // Render stats, charts, table, and bind CSV download
    function renderBatchDashboard(data) {
        // Set stats widgets
        statTotalRows.textContent = data.total_rows;
        
        const posPerc = Math.round((data.pos_count / data.total_rows) * 100) || 0;
        const negPerc = Math.round((data.neg_count / data.total_rows) * 100) || 0;
        const neuPerc = Math.round((data.neu_count / data.total_rows) * 100) || 0;

        statPosPercent.textContent = `${posPerc}%`;
        statNegPercent.textContent = `${negPerc}%`;
        statNeuPercent.textContent = `${neuPerc}%`;

        // Donut Sentiment Distribution Chart
        destroyChart(batchDistributionChartInstance);
        const distCtx = document.getElementById('batchDistributionChart').getContext('2d');
        batchDistributionChartInstance = new Chart(distCtx, {
            type: 'doughnut',
            data: {
                labels: ['Positive', 'Negative', 'Neutral'],
                datasets: [{
                    data: [data.pos_count, data.neg_count, data.neu_count],
                    backgroundColor: ['#2ecc71', '#e74c3c', '#95a5a6'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 12, font: { family: 'Poppins' } }
                    }
                }
            }
        });

        // Keywords Horizontal Bar Chart
        destroyChart(batchKeywordsChartInstance);
        const keywordCtx = document.getElementById('batchKeywordsChart').getContext('2d');
        const keywordsLabels = data.top_words.map(w => w.word);
        const keywordsCounts = data.top_words.map(w => w.count);

        batchKeywordsChartInstance = new Chart(keywordCtx, {
            type: 'bar',
            data: {
                labels: keywordsLabels,
                datasets: [{
                    label: 'Count',
                    data: keywordsCounts,
                    backgroundColor: 'rgba(74, 144, 226, 0.85)',
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y', // horizontal bar chart
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    },
                    y: {
                        grid: { display: false }
                    }
                }
            }
        });

        // Bind CSV download link
        downloadBtn.href = data.download_url;

        // Save preview values for table filtration
        globalPreviewData = data.preview_data || [];
        globalTextCol = data.text_column;

        renderPreviewTable();
        batchResultSection.style.display = 'block';
        batchResultSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Render table with pagination/search/sentiment filter locally
    function renderPreviewTable() {
        tableHeaderRow.innerHTML = '';
        tableBody.innerHTML = '';

        if (globalPreviewData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="3">No preview rows available.</td></tr>';
            return;
        }

        // We show columns: Row Number, the original text column, and predicted_sentiment
        const headers = ['#', 'Text Content', 'Predicted Sentiment'];
        headers.forEach(h => {
            const th = document.createElement('th');
            th.textContent = h;
            tableHeaderRow.appendChild(th);
        });

        const filterVal = tableSentimentFilter.value;
        const searchVal = tableSearch.value.toLowerCase().trim();

        let rowCounter = 1;

        globalPreviewData.forEach((row) => {
            const textValue = String(row[globalTextCol] || '');
            const sentiment = String(row['predicted_sentiment'] || 'neutral');

            // Apply sentiment filters
            if (filterVal !== 'all' && sentiment !== filterVal) {
                return;
            }

            // Apply search filters
            if (searchVal !== '' && !textValue.toLowerCase().includes(searchVal)) {
                return;
            }

            const tr = document.createElement('tr');

            // Cell 1: Count Index
            const tdIndex = document.createElement('td');
            tdIndex.textContent = rowCounter++;
            tdIndex.style.fontWeight = 'bold';
            tdIndex.style.color = 'var(--text-muted)';
            tdIndex.style.width = '50px';

            // Cell 2: Text preview
            const tdText = document.createElement('td');
            tdText.textContent = textValue;
            tdText.title = textValue; // tooltip support

            // Cell 3: Sentiment Badge
            const tdSentiment = document.createElement('td');
            tdSentiment.style.width = '160px';
            let badgeClass = 'badge-neu';
            if (sentiment === 'positive') badgeClass = 'badge-pos';
            else if (sentiment === 'negative') badgeClass = 'badge-neg';

            tdSentiment.innerHTML = `<span class="table-badge ${badgeClass}">${sentiment}</span>`;

            tr.appendChild(tdIndex);
            tr.appendChild(tdText);
            tr.appendChild(tdSentiment);

            tableBody.appendChild(tr);
        });

        if (tableBody.children.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="3" style="text-align:center; padding: 2rem; color: var(--text-muted);"><i class="fas fa-folder-open" style="font-size:1.5rem; margin-bottom:8px; display:block;"></i> No rows match search filters.</td>`;
            tableBody.appendChild(tr);
        }
    }

    // Re-filter table on user interaction
    tableSearch.addEventListener('input', renderPreviewTable);
    tableSentimentFilter.addEventListener('change', renderPreviewTable);

    // ----------------------------------------------------
    // MLOps Retraining & Feedback Integration (Feature 2)
    // ----------------------------------------------------
    const submitFeedbackBtn = document.getElementById('submitFeedbackBtn');
    const correctionSentimentSelect = document.getElementById('correctionSentimentSelect');
    const runRetrainingBtn = document.getElementById('runRetrainingBtn');
    
    let historyChartInstance = null;

    function updateRetrainHistory(historyData) {
        if (!historyData || historyData.length === 0) return;

        // 1. Populate the Run Event Log List
        const listContainer = document.getElementById('retrainHistoryList');
        if (listContainer) {
            listContainer.innerHTML = '';
            // Render in reverse order (newest first)
            [...historyData].reverse().forEach((run, index) => {
                const li = document.createElement('li');
                li.className = 'history-list-item';
                
                const leftDiv = document.createElement('div');
                
                const timeSpan = document.createElement('span');
                timeSpan.className = 'history-time';
                timeSpan.textContent = run.timestamp === 'Baseline Run' ? 'Baseline Model' : run.timestamp;
                leftDiv.appendChild(timeSpan);
                
                const metaSpan = document.createElement('span');
                metaSpan.className = 'history-meta';
                metaSpan.textContent = `(${run.samples_trained} samples, ${run.feedback_count} feedback)`;
                leftDiv.appendChild(metaSpan);
                
                const rightDiv = document.createElement('div');
                const badge = document.createElement('span');
                badge.className = 'history-acc-badge';
                badge.textContent = run.accuracy;
                rightDiv.appendChild(badge);
                
                li.appendChild(leftDiv);
                li.appendChild(rightDiv);
                listContainer.appendChild(li);
            });
        }

        // 2. Draw or Update the Chart.js Line Graph
        const ctx = document.getElementById('retrainHistoryChart');
        if (ctx) {
            const labels = historyData.map((run, i) => {
                if (run.timestamp === 'Baseline Run') return 'Baseline';
                return `Run #${i}`;
            });
            const accuracies = historyData.map(run => {
                return parseFloat(run.accuracy);
            });

            if (historyChartInstance) {
                historyChartInstance.destroy();
            }

            historyChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Validation Accuracy (%)',
                        data: accuracies,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.05)',
                        borderWidth: 2,
                        tension: 0.3,
                        pointBackgroundColor: '#2563eb',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1.5,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const runInfo = historyData[context.dataIndex];
                                    return [
                                        `Accuracy: ${context.parsed.y}%`,
                                        `Size: ${runInfo.samples_trained} samples`,
                                        `Feedback: ${runInfo.feedback_count} logs`
                                    ];
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            ticks: {
                                font: { size: 9 },
                                callback: function(value) { return value + '%'; }
                            },
                            grid: { color: 'rgba(0, 0, 0, 0.04)' }
                        },
                        x: {
                            ticks: { font: { size: 9 } },
                            grid: { display: false }
                        }
                    }
                }
            });
        }
    }

    // Fetch and populate current ML accuracy and feedback count on load
    async function loadModelStats() {
        try {
            const response = await fetch('/model_stats?t=' + Date.now());
            if (response.ok) {
                const data = await response.json();
                document.getElementById('retrainAccuracyVal').textContent = data.accuracy;
                document.getElementById('retrainFeedbackCountVal').textContent = data.feedback_count;
                // Toggle empty state message based on feedback count
                const feedbackEmptyMsg = document.getElementById('feedbackEmptyMsg');
                if (feedbackEmptyMsg) {
                    feedbackEmptyMsg.style.display = data.feedback_count > 0 ? 'none' : 'block';
                }
                if (data.history) {
                    updateRetrainHistory(data.history);
                }
            }
        } catch (e) {
            console.error('Error fetching model stats:', e);
        }
    }
    
    // Call stats load on startup
    loadModelStats();

    // Bind event for submit feedback correction
    if (submitFeedbackBtn && correctionSentimentSelect) {
        submitFeedbackBtn.addEventListener('click', async () => {
            const textVal = textInput.value.trim();
            const sentimentVal = correctionSentimentSelect.value;
            
            if (!textVal) {
                showToast('Please type or dictate some text to correct first!', 'warning');
                return;
            }
            
            try {
                submitFeedbackBtn.disabled = true;
                submitFeedbackBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
                
                const response = await fetch('/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: textVal, correct_sentiment: sentimentVal })
                });
                
                if (!response.ok) throw new Error('Failed to submit correction feedback.');
                
                const data = await response.json();
                showToast('Feedback saved! Click Retrain Model in the MLOps section to update the model.', 'success');
                
                // Sync the feedback count on the MLOps card
                document.getElementById('retrainFeedbackCountVal').textContent = data.feedback_count;
                
                // Toggle feedback empty state message
                const feedbackEmptyMsgFb = document.getElementById('feedbackEmptyMsg');
                if (feedbackEmptyMsgFb) {
                    feedbackEmptyMsgFb.style.display = data.feedback_count > 0 ? 'none' : 'block';
                }
                
                // Show inline success banner
                const feedbackSuccessBanner = document.getElementById('feedbackSuccessBanner');
                if (feedbackSuccessBanner) {
                    feedbackSuccessBanner.style.display = 'block';
                }
                submitFeedbackBtn.innerHTML = '<i class="fas fa-check"></i> Feedback Submitted';
            } catch (error) {
                console.error(error);
                showToast('Error submitting feedback. Please try again.', 'error');
                submitFeedbackBtn.disabled = false;
                submitFeedbackBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Feedback';
            }
        });
    }

    // Bind go-to-MLOps scroll button inside feedback success banner
    const goToMlopsBtn = document.getElementById('goToMlopsBtn');
    if (goToMlopsBtn) {
        goToMlopsBtn.addEventListener('click', () => {
            const mlopsCard = document.querySelector('.MLOps-card');
            if (mlopsCard) {
                mlopsCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }

    // Bind event for run MLOps retraining loop
    if (runRetrainingBtn) {
        runRetrainingBtn.addEventListener('click', async () => {
            try {
                runRetrainingBtn.disabled = true;
                runRetrainingBtn.innerHTML = '<i class="fas fa-cog fa-spin"></i> Retraining Pipeline...';
                
                const response = await fetch('/retrain', {
                    method: 'POST'
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to retrain model pipeline.');
                }
                
                const data = await response.json();
                showToast('ML Model retrained and reloaded in-memory successfully!', 'success');
                
                // Update stats widgets
                document.getElementById('retrainAccuracyVal').textContent = data.accuracy;
                document.getElementById('retrainFeedbackCountVal').textContent = data.feedback_count;
                if (data.history) {
                    updateRetrainHistory(data.history);
                }
                
                // Reset correction UI buttons if they had submitted correction
                if (submitFeedbackBtn) {
                    submitFeedbackBtn.disabled = false;
                    submitFeedbackBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Feedback';
                    const feedbackSuccessBannerR = document.getElementById('feedbackSuccessBanner');
                    if (feedbackSuccessBannerR) feedbackSuccessBannerR.style.display = 'none';
                }
                // Update feedback empty state after retraining
                const feedbackEmptyMsgR = document.getElementById('feedbackEmptyMsg');
                if (feedbackEmptyMsgR) {
                    feedbackEmptyMsgR.style.display = data.feedback_count > 0 ? 'none' : 'block';
                }
                
                // Re-run analysis immediately if result is visible so user sees the change in real-time
                const currentText = textInput.value.trim();
                if (currentText && resultSection.style.display !== 'none') {
                    performSingleAnalysis(currentText);
                }
            } catch (error) {
                console.error(error);
                showToast(`Retraining error: ${error.message}`, 'error');
            } finally {
                runRetrainingBtn.disabled = false;
                runRetrainingBtn.innerHTML = '<i class="fas fa-cog"></i> Retrain Model';
            }
        });
    }

    // Bind toggle click listener for ML Accuracy History card
    const toggleHistoryBtn = document.getElementById('toggleHistoryBtn');
    const retrainHistoryContainer = document.getElementById('retrainHistoryContainer');
    if (toggleHistoryBtn && retrainHistoryContainer) {
        toggleHistoryBtn.addEventListener('click', () => {
            if (retrainHistoryContainer.style.display === 'none') {
                retrainHistoryContainer.style.display = 'block';
                toggleHistoryBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide ML History';
                // Trigger chart update in case sizes changed or it was drawn hidden
                if (historyChartInstance) {
                    historyChartInstance.update();
                }
            } else {
                retrainHistoryContainer.style.display = 'none';
                toggleHistoryBtn.innerHTML = '<i class="fas fa-history"></i> ML Accuracy History';
            }
        });
    }

    // Bind click event for Reset Model button (premium two-step confirmation pattern)
    const resetModelBtn = document.getElementById('resetModelBtn');
    if (resetModelBtn) {
        resetModelBtn.addEventListener('click', async () => {
            if (!resetModelBtn.classList.contains('confirm-state')) {
                resetModelBtn.classList.add('confirm-state');
                resetModelBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Confirm Reset?';
                
                // Revert after 3 seconds if not clicked again
                resetModelBtn.revertTimeout = setTimeout(() => {
                    resetModelBtn.classList.remove('confirm-state');
                    resetModelBtn.innerHTML = '<i class="fas fa-undo"></i> Reset Model';
                }, 3000);
                return;
            }
            
            // Clear timeout if clicked within 3s window
            clearTimeout(resetModelBtn.revertTimeout);
            resetModelBtn.classList.remove('confirm-state');
            
            try {
                resetModelBtn.disabled = true;
                resetModelBtn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Resetting Model...';
                
                const response = await fetch('/reset_model', {
                    method: 'POST'
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to reset model pipeline.');
                }
                
                const data = await response.json();
                showToast('Model and feedback database reset to baseline state successfully!', 'success');
                
                // Update stats widgets
                document.getElementById('retrainAccuracyVal').textContent = data.accuracy;
                document.getElementById('retrainFeedbackCountVal').textContent = data.feedback_count;
                if (data.history) {
                    updateRetrainHistory(data.history);
                }
                
                // Reset correction UI buttons if they had submitted correction
                if (submitFeedbackBtn) {
                    submitFeedbackBtn.disabled = false;
                    submitFeedbackBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Feedback';
                    const feedbackSuccessBannerRst = document.getElementById('feedbackSuccessBanner');
                    if (feedbackSuccessBannerRst) feedbackSuccessBannerRst.style.display = 'none';
                }
                // Update feedback empty state after reset
                const feedbackEmptyMsgReset = document.getElementById('feedbackEmptyMsg');
                if (feedbackEmptyMsgReset) {
                    feedbackEmptyMsgReset.style.display = data.feedback_count > 0 ? 'none' : 'block';
                }
                
                // Re-run analysis immediately if result is visible so user sees the change in real-time
                const currentText = textInput.value.trim();
                if (currentText && resultSection.style.display !== 'none') {
                    performSingleAnalysis(currentText);
                }
            } catch (error) {
                console.error(error);
                showToast(`Reset error: ${error.message}`, 'error');
            } finally {
                resetModelBtn.disabled = false;
                resetModelBtn.innerHTML = '<i class="fas fa-undo"></i> Reset Model';
            }
        });
    }
});