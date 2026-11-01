Pod::Spec.new do |s|
  s.name           = 'TartanCameraInfo'
  s.version        = '1.0.0'
  s.summary        = 'Fréquences de capture de la caméra arrière'
  s.description    = 'Détecte les fréquences d images disponibles pour proposer la meilleure.'
  s.author         = 'Tartan'
  s.homepage       = 'https://tartan.coach'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
