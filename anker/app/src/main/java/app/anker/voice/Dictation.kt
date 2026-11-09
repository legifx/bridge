package app.anker.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer

/**
 * Fortlaufendes Diktat. Android beendet die Spracherkennung nach jeder Sprechpause;
 * hier wird sie so lange neu gestartet, bis [stop] aufgerufen wird, und alle Teile
 * werden aneinandergehaengt. So kannst du einfach drauflos reden.
 */
class Dictation(
    private val context: Context,
    private val onText: (committed: String, partial: String) -> Unit,
    private val onState: (listening: Boolean, error: String?) -> Unit,
) {
    private var recognizer: SpeechRecognizer? = null
    private var listening = false
    private val committed = StringBuilder()

    val available: Boolean get() = SpeechRecognizer.isRecognitionAvailable(context)

    fun start(existing: String) {
        if (listening) return
        committed.clear(); committed.append(existing.trim())
        listening = true
        onState(true, null)
        listenOnce()
    }

    fun stop() {
        listening = false
        recognizer?.stopListening()
        recognizer?.destroy()
        recognizer = null
        onState(false, null)
    }

    private fun listenOnce() {
        if (!listening) return
        recognizer?.destroy()
        val r = SpeechRecognizer.createSpeechRecognizer(context)
        recognizer = r
        r.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onEvent(eventType: Int, params: Bundle?) {}

            override fun onPartialResults(partialResults: Bundle?) {
                val p = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
                onText(committed.toString(), p)
            }

            override fun onResults(results: Bundle?) {
                val t = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
                if (t.isNotBlank()) {
                    if (committed.isNotEmpty()) committed.append(' ')
                    committed.append(t.trim())
                }
                onText(committed.toString(), "")
                listenOnce()
            }

            override fun onError(error: Int) {
                when (error) {
                    SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> listenOnce()
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> fail("Mikrofon-Berechtigung fehlt.")
                    SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> fail("Spracherkennung braucht gerade Internet.")
                    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> listenOnce()
                    else -> if (listening) listenOnce()
                }
            }
        })
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "de-DE")
            .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            .putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 4000L)
            .putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 3000L)
        r.startListening(intent)
    }

    private fun fail(msg: String) {
        listening = false
        recognizer?.destroy(); recognizer = null
        onState(false, msg)
    }
}
