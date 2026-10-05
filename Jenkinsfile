pipeline {
    agent any

    options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
        timestamps()
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh 'git log -1 --oneline'
            }
        }

        stage('Environment Check') {
            steps {
                sh 'git --version'
                sh 'docker version'
                sh 'docker buildx version'
            }
        }

        stage('Build AI') {
            steps {
                sh 'docker build -t firis-ai:ci ./ai'
            }
        }

        stage('Build Backend') {
            steps {
                sh 'docker build -t firis-backend:ci ./backend'
            }
        }

        stage('Build Frontend') {
            steps {
                sh 'docker build -t firis-frontend:ci ./frontend'
            }
        }

        stage('Verify Images') {
            steps {
                sh 'docker image inspect firis-ai:ci > /dev/null'
                sh 'docker image inspect firis-backend:ci > /dev/null'
                sh 'docker image inspect firis-frontend:ci > /dev/null'
                sh 'docker images | grep firis'
            }
        }
    }

    post {
        success {
            echo 'FIRIS CI build succeeded.'
        }

        failure {
            echo 'FIRIS CI build failed.'
        }
    }
}
