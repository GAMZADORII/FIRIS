pipeline {
    agent any

    environment {
        DEPLOY_DIR = '/mnt/d/FIRIS'
    }

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
                sh 'docker compose version'
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

        stage('Validate Deploy Config') {
            steps {
                sh '''
                    docker compose \
                      --project-directory "$DEPLOY_DIR" \
                      --env-file "$DEPLOY_DIR/.env" \
                      -f "$WORKSPACE/docker-compose.yml" \
                      config > /dev/null

                    echo "FIRIS deploy compose config is valid."
                '''
            }
        }

        stage('Prepare Deploy Images') {
            steps {
                sh '''
                    docker tag firis-ai:ci firis-ai:local
                    docker tag firis-backend:ci firis-backend:local
                    docker tag firis-frontend:ci firis-frontend:local
                '''
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    set -eu

                    docker compose \
                      --project-directory "$DEPLOY_DIR" \
                      --env-file "$DEPLOY_DIR/.env" \
                      -f "$WORKSPACE/docker-compose.yml" \
                      up -d \
                      --no-build \
                      --no-deps \
                      --force-recreate \
                      backend ai frontend

                    docker compose \
                      --project-directory "$DEPLOY_DIR" \
                      --env-file "$DEPLOY_DIR/.env" \
                      -f "$WORKSPACE/docker-compose.yml" \
                      up -d \
                      --no-build \
                      --no-deps \
                      --force-recreate \
                      ai-worker
                '''
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                    set -eu

                    check_url() {
                        name="$1"
                        url="$2"
                        host_header="${3:-}"
                        count=1

                        while [ "$count" -le 30 ]; do
                            if [ -n "$host_header" ]; then
                                curl --max-time 5 -fsS -H "Host: $host_header" "$url" > /tmp/firis-health-response && success=true || success=false
                            else
                                curl --max-time 5 -fsS "$url" > /tmp/firis-health-response && success=true || success=false
                            fi

                            if [ "$success" = "true" ]; then
                                echo "$name health check: OK"
                                cat /tmp/firis-health-response
                                echo
                                return 0
                            fi

                            echo "$name waiting... ($count/30)"
                            sleep 2
                            count=$((count + 1))
                        done

                        echo "$name health check: FAILED"
                        return 1
                    }

                    check_url "AI" "http://host.docker.internal:8000/health"
                    check_url "Backend" "http://host.docker.internal:8080/api/health"
                    check_url "Frontend" "http://host.docker.internal:5173/" "localhost:5173"

                    worker_id=$(docker compose \
                      --project-directory "$DEPLOY_DIR" \
                      --env-file "$DEPLOY_DIR/.env" \
                      -f "$WORKSPACE/docker-compose.yml" \
                      ps -q ai-worker)

                    test -n "$worker_id"

                    worker_status=$(docker inspect -f '{{.State.Status}}' "$worker_id")
                    worker_restart_count=$(docker inspect -f '{{.RestartCount}}' "$worker_id")

                    echo "AI Worker status=$worker_status restartCount=$worker_restart_count"

                    test "$worker_status" = "running"
                '''
            }
        }
    }

    post {
        success {
            echo 'FIRIS CI/CD build and deploy succeeded.'
        }

        failure {
            echo 'FIRIS CI/CD build or deploy failed.'
        }
    }
}
