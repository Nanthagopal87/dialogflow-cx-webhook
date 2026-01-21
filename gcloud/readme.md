export projectid=prj-gdg-ai-meetup-20250717-1
export projectnum=114596681998
export region=us-central1
export zone=us-central1-a
echo $projectid
echo $projectnum
echo $region
echo $zone


5. Create Producer VPC Network

VPC Network
```
gcloud compute networks create producer-vpc --subnet-mode custom
```

## Create Subnets

```bash
gcloud compute networks subnets create producer-subnet \
    --network=producer-vpc \
    --range=10.0.0.0/28 \
    --region=$region

gcloud compute networks subnets create lb-proxy-subnet \
    --network=producer-vpc \
    --range=10.100.100.0/24 \
    --region=$region \
    --purpose=REGIONAL_MANAGED_PROXY \
    --role=ACTIVE

gcloud compute networks subnets create psc-nat-subnet \
    --network=producer-vpc \
    --region=$region \
    --range=10.100.101.0/24 \
    --purpose=PRIVATE_SERVICE_CONNECT

```

6. Create Hello World Cloud Run 

gcloud projects add-iam-policy-binding $projectid --member=serviceAccount:$projectnum-compute@developer.gserviceaccount.com --role=roles/run.builder


gcloud beta run deploy dialogflow-cx-webhook \
    --source . \
    --platform=managed \
    --ingress=internal \
    --allow-unauthenticated \
    --no-default-url \
    --region=$region

7. Expose Hello World Cloud Run through an Internal Application Load Balancer 

## Reserve a static internal IP address for your load balancer forwarding rule.

```
gcloud compute addresses create cloudrun-ip \
 --region=$region \
 --subnet=producer-subnet

gcloud compute addresses describe cloudrun-ip --region=$region

address: 10.0.0.9
addressType: INTERNAL

```

## Create the Regional Internal Application Load Balancer

```bash

gcloud compute network-endpoint-groups create cloudrun-producer-neg \
    --region=$region \
    --network-endpoint-type=serverless \
    --cloud-run-service=dialogflow-cx-webhook

gcloud compute backend-services create cloudrun-producer-bes \
    --load-balancing-scheme=INTERNAL_MANAGED \
    --protocol=HTTP \
    --region=$region

gcloud compute backend-services add-backend cloudrun-producer-bes \
        --region=$region \
        --network-endpoint-group=cloudrun-producer-neg \
        --network-endpoint-group-region=$region

gcloud compute url-maps create producer-urlmap \
        --default-service=cloudrun-producer-bes \
        --region=$region

gcloud compute target-http-proxies create producer-http-proxy \
        --url-map=producer-urlmap \
        --region=$region


gcloud compute forwarding-rules create cloudrun-fr \
        --load-balancing-scheme=INTERNAL_MANAGED \
        --network=producer-vpc \
        --subnet=producer-subnet \
        --address=cloudrun-ip \
        --target-http-proxy=producer-http-proxy \
        --target-http-proxy-region=$region \
        --region=$region \
        --ports=80 \
        --allow-global-access
```

8. Test Hello World Cloud Run Exposed Through Load Balancer 

## Create Test VM

```
gcloud compute instances create producer-client \
    --zone=$zone \
    --subnet=producer-subnet \
    --no-address \
    --scopes=cloud-platform
```

```
gcloud compute ssh \
    --zone "$zone" "producer-client" \
    --tunnel-through-iap \
    --project $projectid
```

Replace <loadbalancer-ip> with the IP address that you created earlier (example 10.0.0.2).


## Test Hello World

In producer-vm

```
curl <loadbalancer-ip>

curl -X POST 10.0.0.9

```

Expected Output

```
{"fulfillmentResponse":{"messages":[{"text":{"text":["I apologize, but there was an internal error processing your request. Please try again later."]}}]}}
```

9. Convert Http to Https Loadbalncer


10. 

Step 1: Generate Private Key

openssl genrsa -out webhook.internal.key 2048

11. Copy cert to VM
gcloud compute scp webhook.internal.pem producer-client:/tmp/mycert.crt --zone=us-central1-a

12. Test from Client VM with certificate

Option 1:
Request:
curl -k -X POST https://10.0.0.9

Response:
{"fulfillmentResponse":{"messages":[{"text":{"text":["I apologize, but there was an internal error processing your request. Please try again later."]}}]}}

Option 2:
Request:
curl --cacert mycert.pem -X POST https://10.0.0.9

Response:
{"fulfillmentResponse":{"messages":[{"text":{"text":["I apologize, but there was an internal error processing your request. Please try again later."]}}]}}

13. Add Namespace

demo-ns

14. Create Service Directory

demo-svc

15. Add Endpoint in Service Directory
Endpoint name: lb-endpoint
IP Address: 10.0.0.9
Port: 443
Network: producer-vpc

16. 

Display Name:
poc-private-webhook

Webhook Timeout: 10

Type: Service Directory

Service Directory:
projects/prj-gdg-ai-meetup-20250717-1/locations/us-central1/namespaces/demo-ns/services/demo-svc

WebHook URL:
https://webhook.internal

Service Agent Auth:
ID Token




### Testing

Intent: test private webhook


Possible Errors:
State: URL_TIMEOUT, Reason: TIMEOUT_WEB

Reason: Wring CA Certificate file


Service Directory Viewer
Private Service Connect Authorized Service



