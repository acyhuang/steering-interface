# frontend

## user flow

- create a new conversation
- create new variant
- send message, receive response
- steer on a feature
- see comparison of original and modified response
- confirm modification
- send message, receive response


## components
- Chat.tsx: host chat interface (input, messages)
- Controls.tsx: hide/show 
    - FeatureTable.tsx: data table of features with header (filter, sort)
    - FeatureEditor.tsx: allows steering on selected feature

## state manatement
App.tsx - handles everything
pass props to children

## contexts
later
