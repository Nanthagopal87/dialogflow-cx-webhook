Error:

kubectl describe gateway internal-https-gateway
Name:         internal-https-gateway
Namespace:    default
Labels:       <none>
Annotations:  networking.gke.io/last-reconcile-time: 2026-01-20T02:28:29Z
API Version:  gateway.networking.k8s.io/v1
Kind:         Gateway
Metadata:
  Creation Timestamp:  2026-01-20T02:11:01Z
  Finalizers:
    gateway.finalizer.networking.gke.io
  Generation:        1
  Resource Version:  1768876109551743016
  UID:               3dceaf06-faa3-4b45-b64f-8b3a678fa1d6
Spec:
  Addresses:
    Type:              IPAddress
    Value:             10.0.0.9
  Gateway Class Name:  gke-l7-rilb
  Listeners:
    Allowed Routes:
      Namespaces:
        From:  Same
    Name:      https
    Port:      443
    Protocol:  HTTPS
    Tls:
      Certificate Refs:
        Group:
        Kind:   Secret
        Name:   webhook-server-tls
      Mode:     Terminate
Status:
  Conditions:
    Last Transition Time:  2026-01-20T02:12:56Z
    Message:               The OSS Gateway API has deprecated this condition, do not depend on it.
    Observed Generation:   1
    Reason:                Scheduled
    Status:                True
    Type:                  Scheduled
    Last Transition Time:  2026-01-20T02:12:56Z
    Message:
    Observed Generation:   1
    Reason:                Accepted
    Status:                True
    Type:                  Accepted
    Last Transition Time:  2026-01-20T02:12:56Z
    Message:               Error GWCER106: Gateway "default/internal-https-gateway" is invalid, err: unsupported address type "IPAddress", only "NamedAddress" is supported..
    Observed Generation:   1
    Reason:                Invalid
    Status:                False
    Type:                  Programmed
    Last Transition Time:  2026-01-20T02:12:56Z
    Message:               The OSS Gateway API has altered the "Ready" condition semantics and reserved it for future use.  GKE Gateway will stop emitting it in a future update, use "Programmed" instead.
    Observed Generation:   1
    Reason:                NotReady
    Status:                False
    Type:                  Ready
    Last Transition Time:  2026-01-20T02:12:56Z
    Message:               Gateway: Invalid : Error GWCER106: Gateway "default/internal-https-gateway" is invalid, err: unsupported address type "IPAddress", only "NamedAddress" is supported..
    Observed Generation:   1
    Reason:                Error
    Status:                False
    Type:                  networking.gke.io/GatewayHealthy
  Listeners:
    Attached Routes:  1
    Conditions:
      Last Transition Time:  2026-01-20T02:12:56Z
      Message:               The Detached condition has been deprecated by the OSS API, use Accepted instead.
      Observed Generation:   1
      Reason:                UnsupportedAddress
      Status:                True
      Type:                  Detached
      Last Transition Time:  2026-01-20T02:12:56Z
      Message:               Error GWCER106: Gateway "default/internal-https-gateway" is invalid, err: unsupported address type "IPAddress", only "NamedAddress" is supported..
      Observed Generation:   1
      Reason:                UnsupportedAddress
      Status:                False
      Type:                  Accepted
    Name:                    https
    Supported Kinds:
      Group:  gateway.networking.k8s.io
      Kind:   HTTPRoute
Events:
  Type     Reason  Age                From                   Message
  ----     ------  ----               ----                   -------
  Normal   ADD     18m                sc-gateway-controller  default/internal-https-gateway
  Normal   UPDATE  18m                sc-gateway-controller  default/internal-https-gateway
  Normal   SYNC    18m (x7 over 18m)  sc-gateway-controller  default/internal-https-gateway
  Warning  SYNC    88s (x5 over 17m)  sc-gateway-controller  failed to translate Gateway "default/internal-https-gateway": Error GWCER106: Gateway "default/internal-https-gateway" is invalid, err: unsupported address type "IPAddress", only "NamedAddress" is supported..


Fix:
addresses:
  - type: NamedAddress       # Changed from IPAddress
    value: cloudrun-ip       # Changed from 10.0.0.9 to the GCP Resource Name



State: URL_ERROR, Reason: ERROR_OTHER, HTTP status code: 403