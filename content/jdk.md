# Installer le JDK 17

Minecraft 1.20.1 s'exécute sur **Java 17**. Il faut un **JDK** (kit de développement), pas seulement un **JRE**.

> :attention: **Version exacte : 17.** Java 8 est trop ancien ; Java 21 fait échouer certaines tâches ForgeGradle 6 et le lancement du jeu 1.20.1. Vous pouvez avoir d'autres versions installées en parallèle, du moment que le projet pointe vers un JDK 17.

## Quelle distribution choisir

Toutes ces distributions sont gratuites et équivalentes pour le modding. Choisissez-en **une** :

| Distribution | Lien | Remarque |
|--------------|------|----------|
| **Eclipse Temurin 17** (Adoptium) | [adoptium.net](https://adoptium.net/temurin/releases/?version=17) | Le plus courant dans la communauté |
| **Microsoft Build of OpenJDK 17** | [microsoft.com/openjdk](https://learn.microsoft.com/java/openjdk/download) | Pratique sur Windows |
| **Amazon Corretto 17** | [aws.amazon.com/corretto](https://aws.amazon.com/corretto/) | Support long terme |
| **Azul Zulu 17** | [azul.com/downloads](https://www.azul.com/downloads/?version=java-17-lts) | — |

> :astuce: **Ne prenez pas** le « JetBrains Runtime » comme JDK de projet. Le JBR est excellent pour *lancer* le jeu depuis IntelliJ (meilleur *hot-swap*), mais gardez un Temurin/Microsoft 17 comme JDK de compilation. IntelliJ peut d'ailleurs télécharger un JDK 17 pour vous (voir [IntelliJ](#/intellij)).

## Installation sous Windows

1. Téléchargez l'installeur **`.msi`** de Temurin 17 (architecture **x64** dans la quasi-totalité des cas).
2. Lancez-le. Dans les options, activez :
   - **Set JAVA_HOME variable**
   - **Add to PATH**
   - (facultatif) **JavaSoft (Oracle) registry keys**
3. Terminez l'installation.

### Vérifier

Ouvrez un **nouveau** terminal (PowerShell) :

```bash
java -version
```

Attendu (le numéro de build varie) :

```text
openjdk version "17.0.13" 2024-10-15
OpenJDK Runtime Environment Temurin-17.0.13+11 (build 17.0.13+11)
OpenJDK 64-Bit Server VM Temurin-17.0.13+11 (build 17.0.13+11, mixed mode, sharing)
```

Vérifiez aussi `JAVA_HOME` :

```bash
echo $env:JAVA_HOME
```

Il doit pointer vers un dossier du type `C:\Program Files\Eclipse Adoptium\jdk-17.0.13.11-hotspot\`.

> :info: Si `java -version` affiche une autre version (souvent le Java du launcher Minecraft dans `PATH`), voyez la section « Gérer plusieurs versions » ci-dessous.

## Installation sous macOS

Avec [Homebrew](https://brew.sh/) :

```bash
brew install --cask temurin@17
/usr/libexec/java_home -V          # liste les JDK installés
```

Pour définir `JAVA_HOME` dans le shell (zsh) :

```bash
echo 'export JAVA_HOME=$(/usr/libexec/java_home -v 17)' >> ~/.zshrc
source ~/.zshrc
java -version
```

## Installation sous Linux

Debian/Ubuntu :

```bash
sudo apt update
sudo apt install temurin-17-jdk    # dépôt Adoptium ; sinon openjdk-17-jdk
java -version
```

Arch :

```bash
sudo pacman -S jdk17-openjdk
sudo archlinux-java set java-17-openjdk
```

## Gérer plusieurs versions de Java

Vous aurez souvent Java 8, 17 et 21 en même temps (autres projets, launcher…). Trois approches :

### 1. Laisser l'IDE gérer (le plus simple pour le modding)

IntelliJ et VS Code peuvent utiliser un JDK **spécifique au projet**, sans toucher au `PATH` du système. C'est la méthode recommandée : voir [IntelliJ](#/intellij) et [VS Code](#/vscode). Le `PATH` système peut rester sur n'importe quelle version.

### 2. Basculer manuellement `JAVA_HOME` (ponctuel, terminal)

PowerShell, pour la session courante uniquement :

```bash
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.13.11-hotspot"
$env:Path = "$env:JAVA_HOME\bin;" + $env:Path
java -version
```

### 3. Un gestionnaire de versions

- **[SDKMAN!](https://sdkman.io/)** (macOS/Linux/WSL) : `sdk install java 17.0.13-tem`, puis `sdk use java 17.0.13-tem`.
- **[jabba](https://github.com/shyiko/jabba)** ou **[jEnv](https://www.jenv.be/)** : alternatives multiplateformes.

Avec SDKMAN!, un fichier **`.sdkmanrc`** à la racine du projet fixe la version pour toute l'équipe :

```properties
java=17.0.13-tem
```

`sdk env install` puis `sdk env` appliquent alors le bon JDK automatiquement en entrant dans le dossier.

## Ce que Gradle utilise réellement

ForgeGradle 6 sélectionne le JDK via la *toolchain* déclarée dans `build.gradle` :

```gradle
java {
    toolchain.languageVersion = JavaLanguageVersion.of(17)
}
```

Si Gradle ne trouve pas de JDK 17, il tente d'en télécharger un (via le *Foojay Disco* resolver, présent dans le MDK). Vous pouvez aussi lui indiquer où chercher :

```bash
./gradlew build -Porg.gradle.java.installations.paths=C:\chemin\vers\jdk-17
```

ou dans `gradle.properties` (utilisateur, pas celui du projet — `~/.gradle/gradle.properties`) :

```properties
org.gradle.java.installations.paths=C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.13.11-hotspot
```

> :astuce: **Vérification finale avant de continuer :** dans le dossier du projet, `./gradlew -version` doit afficher `JVM: 17.0.x`. Si c'est le cas, l'environnement Java est prêt.

Page suivante : **[Le MDK Forge & Gradle](#/mdk)**.
