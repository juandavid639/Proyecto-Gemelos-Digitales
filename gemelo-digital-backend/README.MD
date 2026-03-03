# Gemelo Digital

# Construir backend

docker build -t gemelo-api

/gemelo-digital/gemelo-digital-backend

aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 718624265053.dkr.ecr.us-east-1.amazonaws.com

docker tag gemelo-api 718624265053.dkr.ecr.us-east-1.amazonaws.com/gemelo-digital/gemelo-digital-backend

docker push 718624265053.dkr.ecr.us-east-1.amazonaws.com/gemelo-digital/gemelo-digital-backend:latest



Variables de ambiente ECS


{
  "name": "Main",
  "image": "718624265053.dkr.ecr.us-east-1.amazonaws.com/gemelo-digital/gemelo-digital-backend:latest",
  "cpu": 1024,
  "memoryReservation": 2048,
  "portMappings": [
    {
      "name": "main-8000-tcp",
      "containerPort": 8000,
      "hostPort": 8000,
      "protocol": "tcp"
    }
  ],
  "essential": true,
  "environment": [
    {
      "name": "BRIGHTSPACE_SCOPE",
      "value": "core:*:* Application:*:* Data:*:* grades:gradeobjects:read grades:grades:read outcomes:sets:read"
    },
    {
      "name": "BRIGHTSPACE_BASE_URL",
      "value": "https://cesa.brightspace.com"
    },
    {
      "name": "BRIGHTSPACE_AUTH_URL",
      "value": "https://auth.brightspace.com/oauth2/auth"
    },
    {
      "name": "BRIGHTSPACE_CLIENT_ID",
      "value": "b566f3ae-1907-4ca4-92d7-b423590aabf4"
    },
    {
      "name": "BRIGHTSPACE_LP_VERSION",
      "value": "1.50"
    },    
    {
      "name": "FRONTEND_BASE_URL",
      "value": "https://gemelo.cesa.edu.co"
    },
    {
      "name": "BRIGHTSPACE_CLIENT_SECRET",
      "value": "gkiUceOuC7QU81qGSDSiYeh_R6bEhytvFz7kWYjUG5o"
    },
    {
      "name": "TOOL_BASE_URL",
      "value": "https://ge-9d9d0220a8704eeabada1b951f3f2d37.ecs.us-east-1.on.aws"
    },
    {
      "name": "BRIGHTSPACE_REDIRECT_URI",
      "value": "https://ge-9d9d0220a8704eeabada1b951f3f2d37.ecs.us-east-1.on.aws/auth/brightspace/callback"
    },
    {
      "name": "BRIGHTSPACE_TOKEN_URL",
      "value": "https://auth.brightspace.com/core/connect/token"
    }
  ],
  "environmentFiles": [],
  "mountPoints": [],
  "volumesFrom": [],
  "logConfiguration": {
    "logDriver": "awslogs",
    "options": {
      "awslogs-group": "/aws/ecs/default/gemelo-digital-backend-22de-a4bb",
      "awslogs-region": "us-east-1",
      "awslogs-stream-prefix": "ecs"
    },
    "secretOptions": []
  },
  "systemControls": []
}