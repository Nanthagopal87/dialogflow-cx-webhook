### Test from Local

cd DEV/dialogflow-cx-webhook/

curl -X POST \
     -H "Content-Type: application/json" \
     -d @dialogflow_cx_request.json \
     http://localhost:8080/


### Test it from DialogFlow CX as GenericService using ngrok from local

https://ngrok.com/download/windows/?tab=install
ngrok config add-authtoken <token>
ngrok http 80


### Deploy this application in CloudRUn