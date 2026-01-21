Phase 1: DialogFlow CX + Service Directory + ILB + Cloud Run => Working fine
Phase 2: Dialogflow CX → Service Directory (DNS resolution) → Internal HTTPS Gateway (Envoy Proxy with SSL) → Private GKE Nodes → Node.js Express App. => Working fine

Note: All resources in  same project (vpc, subnet, ilb, cloud run, service directory)

In phase 3, i would like to introduce a shared network and cross project.
e.g prj-producer, prj-consumer
Producer will have application deployed in Cloud Run/GKE with ILB
Consumer wil have DialogFlow Agent and Service Directory

I have tried this usecase, i'm getting Service Directory is not able to identify error, while testing via simulator.

Please guide me on this.