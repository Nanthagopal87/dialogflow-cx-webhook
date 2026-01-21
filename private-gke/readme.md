I have completed a working POC of DialogFlow CX + Service Directory + ILB + Cloud Run. I would like to replace Coud Run with GKE. Please guide to setup the Private GKE and deploy the application in GKE and DialogFLow CX agent access the private enpoint deployed in gke.


This is the complete, consolidated guide to moving your Dialogflow CX webhook from Cloud Run to a **Private GKE Cluster** using the **Gateway API (Internal L7 HTTPS Load Balancer)** and **Service Directory**.

### Phase 1: Environment & Networking
Set your variables and prepare the VPC for an Internal HTTP(S) Load Balancer.

```bash
# 1. Variables
export PROJECT_ID=$(gcloud config get-value project)
export REGION=us-central1
export ZONE=us-central1-a
export VPC_NAME=producer-vpc
export SUBNET_NAME=producer-subnet
export GATEWAY_IP=10.0.0.9  # As per your certificate config
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

# 2. Create Proxy-only Subnet (Required for GKE Gateway API)
gcloud compute networks subnets create lb-proxy-subnet \
    --purpose=REGIONAL_MANAGED_PROXY \
    --role=ACTIVE \
    --region=$REGION \
    --network=$VPC_NAME \
    --range=10.100.100.0/24

# 3. Reserve the Static Internal IP for the Webhook
gcloud compute addresses create webhook-gateway-ip \
    --region=$REGION \
    --subnet=$SUBNET_NAME \
    --addresses=$GATEWAY_IP
```

---

### Phase 2: Create Private GKE Cluster
The cluster must have the Gateway API enabled and nodes must be private.

```bash
# 1. Create the Cluster
gcloud container clusters create private-webhook-cluster \
    --region=$REGION \
    --node-locations=$ZONE \
    --enable-private-nodes \
    --master-ipv4-cidr=172.16.0.32/28 \
    --enable-ip-alias \
    --network=$VPC_NAME \
    --subnetwork=$SUBNET_NAME \
    --gateway-api=standard \
    --enable-master-authorized-networks \
    --master-authorized-networks $(curl -s ifconfig.me)/32

    Faced quota issue

    reviosed gcloud command

    gcloud container clusters create private-webhook-cluster \
    --region=$REGION \
    --node-locations=$ZONE \
    --enable-private-nodes \
    --master-ipv4-cidr=172.16.0.32/28 \
    --enable-ip-alias \
    --network=$VPC_NAME \
    --subnetwork=$SUBNET_NAME \
    --gateway-api=standard \
    --enable-master-authorized-networks \
    --master-authorized-networks $(curl -s ifconfig.me)/32 \
    --num-nodes=2 \
    --disk-size=50GB \
    --disk-type=pd-balanced

Verify the access from CLI:
gcloud container clusters get-credentials private-webhook-cluster --region us-central1 --project prj-gdg-ai-meetup-20250717-1

Need to install this plugin:
https://docs.cloud.google.com/kubernetes-engine/docs/how-to/cluster-access-for-kubectl#install_plugin

Error:
kubectl get namespaces
E0120 06:52:31.011745   38112 memcache.go:265] "Unhandled Error" err="couldn't get current server API group list: Get \"https://34.46.200.70/api?timeout=32s\": dial tcp 34.46.200.70:443: connectex: A connection attempt failed because the connected party did not properly respond after a period of time, or established connection failed because connected host has failed to respond."


Fix:

# Replace [YOUR_ACTUAL_IP] with the IP you found in Step 1
gcloud container clusters update private-webhook-cluster \
    --region=us-central1 \
    --enable-master-authorized-networks \
    --master-authorized-networks 122.164.246.68/32

gcloud container clusters get-credentials private-webhook-cluster     --location=us-central1

kubectl get namespaces
NAME                          STATUS   AGE
default                       Active   21m
gke-managed-cim               Active   19m
gke-managed-system            Active   19m
gke-managed-volumepopulator   Active   19m

gcloud container clusters describe private-webhook-cluster --region=us-central1 --format="value(endpoint)"
34.46.200.70






# 2. Configure Cloud NAT (Allows private nodes to pull images)
gcloud compute routers create gke-router --network=$VPC_NAME --region=$REGION
gcloud compute routers nats create gke-nat \
    --router=gke-router --region=$REGION \
    --auto-allocate-nat-external-ips --nat-all-subnet-ip-ranges

NAT already exists
```

---

### Phase 3: SSL Certificate & Kubernetes Secret
Use your existing `cert.conf` to generate the cert and upload it to GKE.

```bash
# 1. Generate the self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout webhook.key -out webhook.crt \
    -config cert.conf -extensions req_ext

# 2. Create the Kubernetes TLS Secret
kubectl create secret tls webhook-server-tls \
    --cert=webhook.internal.crt \
    --key=webhook.internal.key
```

---

### Phase 4: Deploy Application and HTTPS Gateway
Save the following as `gke-webhook-setup.yaml` and run `kubectl apply -f gke-webhook-setup.yaml`.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webhook-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: webhook
  template:
    metadata:
      labels:
        app: webhook
    spec:
      containers:
      - name: app
        image: gcr.io/google-samples/hello-app:1.0 # REPLACE WITH YOUR IMAGE
        ports:
        - containerPort: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: webhook-backend-svc
spec:
  type: ClusterIP
  selector:
    app: webhook
  ports:
  - port: 8080
---
kind: Gateway
apiVersion: gateway.networking.k8s.io/v1
metadata:
  name: internal-https-gateway
spec:
  gatewayClassName: gke-l7-rilb # Regional Internal Load Balancer
  listeners:
  - name: https
    protocol: HTTPS
    port: 443
    tls:
      mode: Terminate
      certificateRefs:
      - name: webhook-server-tls
  addresses:
  - type: IPAddress
    value: 10.0.0.9 # Must match your reserved GATEWAY_IP
---
kind: HTTPRoute
apiVersion: gateway.networking.k8s.io/v1
metadata:
  name: webhook-route
spec:
  parentRefs:
  - name: internal-https-gateway
  rules:
  - backendRefs:
    - name: webhook-backend-svc
      port: 8080
```


kubectl apply -f deploy.yaml
kubectl apply -f svc.yaml
kubectl apply -f gateway.yaml
kubectl apply -f route.yaml

kubectl apply -f healthcheck.yaml  (optioanl)

kubectl get pods
kubectl get svc
kubectl get gateway internal-https-gateway
kubectl get httproute webhook-route

kubectl describe gateway internal-https-gateway
kubectl describe httproute webhook-route

kubectl delete gateway internal-https-gateway
kubectl delete httproute webhook-route


curl -k -H "Host: webhook.internal" https://10.0.0.9

4. How to Test Manually (Optional)
If you want to be 100% sure the Load Balancer is working before testing in Dialogflow, run a temporary "curl" pod inside your GKE cluster:
code
Bash
# Start a temporary pod
kubectl run curl-test --image=curlimages/curl -i --tty --rm -- \
    curl -ivk --resolve webhook.internal:443:10.0.0.9 https://webhook.internal/


---

### Phase 5: Service Directory Registration
Register the Gateway IP so Dialogflow CX can resolve it.

```bash
# 1. Create Service Directory Namespace and Service
gcloud service-directory namespaces create gke-webhooks --location=$REGION
gcloud service-directory services create webhook-service \
    --namespace=gke-webhooks --location=$REGION

# 2. Create Endpoint pointing to the Gateway's HTTPS port
gcloud service-directory endpoints create gke-endpoint \
    --service=webhook-service \
    --namespace=gke-webhooks \
    --location=$REGION \
    --address=$GATEWAY_IP \
    --port=443 \
    --network=projects/$PROJECT_ID/global/networks/$VPC_NAME

Delete the old endpoint if required
gcloud service-directory endpoints delete gke-endpoint \
    --service=webhook-service \
    --namespace=gke-webhooks \
    --location=$REGION

```

---

### Phase 6: IAM & Dialogflow CX Access
Grant Dialogflow permission to enter your VPC through the Service Directory.

```bash
# 1. Grant Viewer Role
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:service-$PROJECT_NUMBER@gcp-sa-dialogflow.iam.gserviceaccount.com" \
    --role="roles/servicedirectory.viewer"

# 2. Grant Authorized Service Role (Crucial for Private Network Access)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:service-$PROJECT_NUMBER@gcp-sa-dialogflow.iam.gserviceaccount.com" \
    --role="roles/servicedirectory.pscAuthorizedService"
```

---

### Phase 7: Configure Dialogflow CX Webhook
1.  Go to **Dialogflow CX Console > Manage > Webhooks**.
2.  **Webhook Name:** `gke-private-https-webhook`.
3.  **Webhook URL:** `https://webhook.internal/` (matching your Cert's CN).
4.  **Service Directory:** Toggle **ON**.
    *   **Project:** Your Project ID.
    *   **Location:** Your Region.
    *   **Namespace:** `gke-webhooks`.
    *   **Service:** `webhook-service`.
5.  **CA Certificate:** 
    *   Open your `webhook.crt` file.
    *   Copy the entire text including `-----BEGIN CERTIFICATE-----` and `-----END CERTIFICATE-----`.
    *   Paste it into the **CA Certificate** field in the Dialogflow UI.
6.  **Save.**

### Verification
*   Check Gateway status: `kubectl describe gateway internal-https-gateway` (Ensure "Programmed: True").
* check http route: `kubectl describe httproute webhook-route`

*   Check Endpoint: `gcloud service-directory endpoints describe gke-endpoint --service=webhook-service --namespace=gke-webhooks --location=$REGION`.
*   Test from Dialogflow Simulator.
