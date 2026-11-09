package app.anker

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.Text
import com.anthropic.client.okhttp.AnthropicOkHttpClient

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val c = AnthropicOkHttpClient.builder().apiKey("x").build()
        setContent { Text("hi $c") }
    }
}
