# backend api

This backend supports an application allowing users to steer on an LLM using Goodfire's Ember SDK.

- variants
- conversations 
- features 

variants have specific features associated with them (modified ones)
conversations have specific features associated with them (activated ones)

user can switch between variants in a conversation


Conversation
- id
- currentVariant: Variant
- activatedFeatures: List of FeatureActivation # cached

Variant
- id
- name: str
- modifiedFeatures: Dict[str, float]
- pendingFeatures: Dict[str, float]

Feature (stateless, same as Ember SDK)
- uuid: UUID
- label: str
- activation: int


API response DTO
class Feature:
    uuid: str
    label: str
    activation: float
    modification: float
    pendingModification: float

## user flows
- create a new conversation
- create new variant
- send message, receive response
- steer on a feature
- see comparison of original and modified response
- confirm modification
- send message, receive response

## API endpoints

POST /conversations (create)
<!-- TODO: GET /conversations/{id} (fetch) -->
POST /conversations/{id}/messages (send message)
GET /conversations/{id}/features (fetch features)
GET /conversations/{id}/table-features (fetch table features)

POST/variants (create)
<!-- TODO: GET /variant/{id} (fetch) -->
<!-- TODO: DELETE /variant/{id} (delete) -->
<!-- TODO: POST /conversations/{id}/switch-variant (switch variant) -->

POST /variants/{id}/features/{uuid}/steer (steer feature)
GET /variants/{id}/features/search?query={query}&top_k={top_k} (search features)
POST /variants/{id}/commit-changes (confirm pending)
POST /variants/{id}/reject-changes (reject pending)
POST /variants/{id}/auto-steer (auto steer)
<!-- TODO: DELETE /variants/{id}/modifications (clear modifications) -->

## TODO for v2.1
Local storage
- store conversations, variants
- use dependency injection (like ember client)
active sync between Ember variant and our variant model
- currently using lazy reconstruction