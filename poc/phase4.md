
Integrating Apigee into your Phase 3 architecture is a strategic move for enterprise environments. Since your Apigee instance is already behind a **Network Load Balancer (NLB)** in the Shared VPC, the transition from Service Directory’s perspective is quite straightforward.

Here is how you adjust the Service Directory configuration to point Dialogflow CX to Apigee instead of GKE directly.

### 1. Conceptual Change
In Phase 2/3, Service Directory pointed directly to the GKE Gateway IP. Now, it will point to the **Frontend IP of your Apigee Network Load Balancer**. 

*   **Logic:** Dialogflow CX → Service Directory → Apigee NLB → Apigee Proxy → GKE Webhook.
*   **Networking:** Since Apigee and GKE are in the same Shared VPC, Apigee can reach your GKE pods using their internal Service/Gateway IPs or via the same ILB you already built.

---

### 2. Service Directory Update
You need to update the Endpoint in the **Consumer Project** to reflect the Apigee NLB's internal IP.

```bash
# 1. Delete the GKE-direct endpoint
gcloud service-directory endpoints delete gke-endpoint \
    --service=webhook-service \
    --namespace=gke-webhooks \
    --location=[REGION]

# 2. Create the new endpoint pointing to the Apigee NLB
gcloud service-directory endpoints create apigee-endpoint \
    --service=webhook-service \
    --namespace=gke-webhooks \
    --location=[REGION] \
    --address=[APIGEE_NLB_INTERNAL_IP] \
    --port=443 \
    --network=projects/prj-host/global/networks/[SHARED_VPC_NAME]
```

---

### 3. Dialogflow CX Configuration Changes
In the Dialogflow console, you only need to change the **Webhook URL**. 

*   **New URL:** `https://[APIGEE_PROXY_HOSTNAME]/[BASEPATH]`
    *   *Example:* `https://api.internal.example.com/v1/webhook`
*   **CA Certificate:** If Apigee is using a different SSL certificate (e.g., an enterprise CA or a different self-signed cert), you must replace the `webhook.crt` in the Dialogflow UI with the **Apigee Load Balancer's public certificate**.

---

### 4. Apigee Target Configuration
Inside your Apigee Proxy, you need to point the **Target Endpoint** to your GKE Gateway IP.

1.  **Target Server:** Define a Target Server in Apigee pointing to `10.0.0.9` (your GKE ILB IP).
2.  **SSL Info:** Ensure Apigee is configured to trust the GKE self-signed certificate if you are using HTTPS between Apigee and GKE.

---

### 5. IAM Permissions (Same as Phase 3)
The permissions you set up earlier are still valid because the **Dialogflow Service Agent** still needs to enter the Shared VPC via the Host Project.

*   **In prj-consumer:** `roles/servicedirectory.viewer`
*   **In prj-host:** `roles/servicedirectory.pscAuthorizedService`

---

### 6. Firewall Rules (Host Project)
Since Dialogflow now hits the **Apigee NLB** first, you must ensure the Host Project firewall allows this traffic. 

If Apigee is in its own project but uses the Shared VPC:
1.  Ensure there is a firewall rule in the **Host Project** allowing traffic from the Dialogflow/Service Directory internal ranges to the Apigee NLB IP.
2.  Usually, since the NLB is internal, you just need to ensure the **Host Project** firewalls allow standard internal traffic across the subnets used by Apigee.

### Updated Traffic Flow with Apigee:
1.  **Dialogflow CX** lookups `webhook-service` in Service Directory.
2.  **Service Directory** returns the **Apigee NLB IP**.
3.  **Dialogflow CX** sends the HTTPS request to **Apigee NLB**.
4.  **Apigee** processes the request (Auth, Logging, Spikes, etc.).
5.  **Apigee** routes the request to the **GKE ILB** (`10.0.0.9`).
6.  **GKE ILB** delivers it to your **Node.js Webhook**.

### Why use Apigee here?
*   **Security:** You can enforce API Keys or OAuth before the request even reaches GKE.
*   **Observability:** You get detailed analytics on how Dialogflow is using your webhook.
*   **Abstraction:** If you ever move the webhook back to Cloud Run or to a different GKE cluster, you only update Apigee—you don't have to touch the Dialogflow configuration.

In Google Cloud, the answer depends on whether your "Network Load Balancer" (NLB) is **Passthrough** or **Proxy-based**.

### 1. Internal TCP/UDP Network Load Balancer (Passthrough) — **No Certificate**
If you are using the standard **Internal TCP/UDP Network Load Balancer** (L4), it does **not** have a certificate attachment.
*   **How it works:** This LB is "passthrough." It simply routes raw TCP packets to the backend.
*   **Where the Cert lives:** The SSL/TLS handshake happens directly on the backend. In your case, the certificate would be configured inside **Apigee** (within an Environment Group or Virtual Host) or on a middle-proxy if you have one.
*   **Dialogflow Impact:** You still upload the certificate to Dialogflow, but Dialogflow is essentially doing the handshake with Apigee "through" the NLB.

### 2. Internal Proxy Network Load Balancer — **Yes Certificate**
If you are using an **Internal Proxy Network Load Balancer** (or an Internal Application Load Balancer/ILB), then **yes**, it does have a certificate attachment.
*   **How it works:** The Load Balancer terminates the TLS connection. It decrypts the traffic using its attached certificate and then sends it to the backend (Apigee).
*   **Where the Cert lives:** You attach a **Target SSL Proxy** or **Target HTTPS Proxy** to the Load Balancer, which references a Google Cloud **SSL Certificate resource**.

---

### How to tell which one you have?
Go to the **Google Cloud Console > Network Services > Load Balancing**:
1.  Click on your Load Balancer.
2.  Look at the **Protocol**:
    *   If it says **TCP** or **UDP**: It is a passthrough NLB. **No cert attached.**
    *   If it says **SSL** or **HTTPS**: It is a proxy LB. **Cert is attached.**

### What changes for your Service Directory setup?

Regardless of where the certificate is attached (on the LB or inside Apigee), from the **Service Directory** perspective, the configuration remains the same as we discussed:

1.  **Address:** Use the **Internal IP** of the NLB Frontend.
2.  **Port:** Use **443**.
3.  **Network:** Point to the **Shared VPC** in the Host Project.
4.  **Dialogflow Webhook URL:** Use the hostname that matches the certificate (e.g., `https://api.example.com/...`).
5.  **CA Certificate:** You must paste the **Public Certificate (.crt)** into Dialogflow that corresponds to the endpoint. 
    *   If your LB is proxy-based, use the LB's certificate. 
    *   If your LB is passthrough, use the certificate configured in Apigee.

**Pro-Tip for Apigee:** If you are using **Apigee X**, it often uses **Private Service Connect (PSC)**. If your NLB is actually a PSC "Service Attachment," you don't attach the cert to the attachment itself; the cert is managed in the Apigee Target/Environment configuration or the Load Balancer that sits in front of the PSC endpoint.

Since your **Internal Network Load Balancer (NLB) is Passthrough**, it behaves like a "transparent pipe." It does not look at the SSL certificate; it simply passes the encrypted TCP traffic (Port 443) directly to your Apigee instances.

Here is exactly how to configure this setup for Dialogflow CX:

### 1. Where the Certificate Lives
In a Passthrough setup, the SSL/TLS handshake happens **directly inside Apigee**.
*   You must ensure that your **Apigee Environment Group** is configured with a hostname (e.g., `api.internal.example.com`).
*   The SSL certificate for `api.internal.example.com` must be uploaded to the **Apigee Keystore** and attached to that Environment Group.

### 2. Service Directory Configuration
Even though the LB is passthrough, Service Directory still points to the **Frontend IP of the NLB**.

```bash
# Update the Service Directory endpoint in prj-consumer
gcloud service-directory endpoints create apigee-passthrough-endpoint \
    --service=webhook-service \
    --namespace=gke-webhooks \
    --location=[REGION] \
    --address=[APIGEE_NLB_FRONTEND_IP] \
    --port=443 \
    --network=projects/prj-host/global/networks/[SHARED_VPC_NAME]
```

### 3. Dialogflow CX Webhook Configuration
This part is critical for the "Passthrough" logic:

*   **Webhook URL:** `https://api.internal.example.com/your-path`
    *   *The hostname must match the certificate configured inside Apigee.*
*   **Service Directory Toggle:** ON.
*   **CA Certificate:** Paste the public certificate (`.crt`) that is installed **in Apigee**. 
    *   *Even though the NLB is in the middle, Dialogflow is technically "talking" to Apigee, so it needs Apigee's certificate to trust the connection.*

### 4. Firewall Rules (Host Project)
Because it is a Passthrough NLB, the **Source IP** of the traffic arriving at Apigee might be the Dialogflow internal service range or the LB's internal mapping.

In the **Host Project**, ensure you have a firewall rule that allows traffic on Port 443 to reach the Apigee backend instances:
```bash
gcloud compute firewall-rules create allow-df-to-apigee-passthrough \
    --network=[SHARED_VPC_NAME] \
    --action=ALLOW \
    --direction=INGRESS \
    --source-ranges=130.211.0.0/22,35.191.0.0/16 \
    --rules=tcp:443 \
    --target-tags=[APIGEE_INSTANCE_TAGS]
```
*(Note: Google uses the `35.191.0.0/16` and `130.211.0.0/22` ranges for Health Checks and certain internal traffic proxies).*

### 5. IAM Permissions
No changes here. The **Dialogflow Service Agent** still needs:
1.  `roles/servicedirectory.viewer` in **prj-consumer**.
2.  `roles/servicedirectory.pscAuthorizedService` in **prj-host**.

---

### Summary Table: Passthrough vs. Proxy LB

| Feature | **Passthrough NLB (Current)** | **Proxy ILB (Previous Phase)** |
| :--- | :--- | :--- |
| **TLS Termination** | Inside Apigee | At the Load Balancer |
| **Cert Attachment** | Apigee Environment Group | Target HTTPS Proxy (GCP Resource) |
| **LB Protocol** | TCP | HTTPS |
| **Dialogflow URL** | Must match Apigee Cert | Must match LB Cert |
| **SD IP Address** | NLB Frontend IP | ILB Frontend IP |

### Final Confirmation
If you test in the Dialogflow simulator and get a **TLS Error**, it almost always means the **Hostname** in the Dialogflow URL does not match the **Common Name (CN)** or **Subject Alternative Name (SAN)** of the certificate being served by Apigee. 

**Does the hostname in your Apigee Environment Group match the hostname you used in the Dialogflow Webhook URL?**


To find the certificate details from Apigee for a Passthrough NLB setup, you need to locate the **Environment Group** configuration. Since the NLB is just passing traffic through, Apigee itself handles the handshake using a certificate stored in its **Keystores**.

Here are the two ways to find and extract that certificate:

### Option 1: Using the Google Cloud Console (UI)

1.  **Find the Keystore Name:**
    *   Go to **Apigee > Admin > Environments > Groups**.
    *   Look for the **Environment Group** that handles your webhook hostname (e.g., `api.internal.example.com`).
    *   Note the name of the **Keystore** and the **Key Alias** assigned to that group.

2.  **Export the Certificate:**
    *   Go to **Apigee > Admin > Environments > Keystores**.
    *   Select the **Environment** where your webhook is deployed.
    *   Click on the **Keystore** name you noted in the previous step.
    *   Find the **Alias** (the specific certificate).
    *   There is usually a **"Download"** or **"View Certificate"** button. 
    *   You need the **Public Certificate** in **PEM format** (the text that starts with `-----BEGIN CERTIFICATE-----`).

---

### Option 2: The "Quick Way" using OpenSSL (Recommended)
Since your Apigee NLB is already up and running in the Shared VPC, you can "ask" the Load Balancer to show you the certificate it is receiving from Apigee. 

Run this command from any VM or machine that has **private access** to that Shared VPC (like your GKE nodes or a jump box):

```bash
# Replace [NLB_IP] with your Apigee NLB Internal IP
# Replace [HOSTNAME] with your Apigee Environment Group hostname
openssl s_client -connect [NLB_IP]:443 -servername [HOSTNAME] -showcerts </dev/null
```

**What to look for in the output:**
*   Look for the section starting with `-----BEGIN CERTIFICATE-----` and ending with `-----END CERTIFICATE-----`.
*   If there are multiple certificates (a chain), copy the **first one** (the server certificate).

---

### Option 3: Using the Apigee API
If you prefer the command line, you can use the Apigee management API to get the cert:

```bash
# Set your variables
ORG="your-org-name"
ENV="your-env-name"
KEYSTORE="your-keystore-name"
ALIAS="your-alias-name"

# Get the cert
curl -H "Authorization: Bearer $(gcloud auth print-access-token)" \
"https://apigee.googleapis.com/v1/organizations/$ORG/environments/$ENV/keystores/$KEYSTORE/aliases/$ALIAS/certificate"
```

---

### Important: What to do with this Certificate?

Once you have the text (the PEM format), go back to your **Dialogflow CX Console**:

1.  Navigate to your **Webhook** settings.
2.  Scroll down to the **CA Certificate** field.
3.  **Delete** the old GKE certificate you had there.
4.  **Paste** the certificate text you just retrieved from Apigee.
5.  Ensure the **Webhook URL** hostname matches the **CN (Common Name)** in the certificate you just pasted.

### Why this is different:
In your GKE phase, you created the cert yourself. In this Apigee phase, Apigee is the "Server," so you must use the certificate that the Apigee administrators installed. Dialogflow acts as the "Client" and needs that public key to verify that the Apigee instance it's talking to is authentic.

**Are you able to see the certificate text using one of these methods?**