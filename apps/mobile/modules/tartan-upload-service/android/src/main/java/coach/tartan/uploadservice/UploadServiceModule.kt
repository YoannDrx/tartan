package coach.tartan.uploadservice

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class UploadServiceModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("TartanUploadService")

    // Vrai si le système a accepté le service. Android 12 et plus le refusent depuis l'arrière-plan :
    // l'envoi continue alors tant que le système garde l'app, et reprend à la prochaine ouverture.
    Function("start") { channelId: String, channelName: String, channelDetail: String, title: String, text: String ->
      UploadForegroundService.start(context, channelId, channelName, channelDetail, title, text)
    }

    Function("update") { title: String, text: String, percent: Int ->
      UploadForegroundService.update(context, title, text, percent)
    }

    Function("stop") {
      UploadForegroundService.stop(context)
    }
  }
}
