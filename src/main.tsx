import React from 'react';
import ReactDOM from 'react-dom/client';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import outputs from '../amplify_outputs.json';
import '@aws-amplify/ui-react/styles.css';
import './styles/app.css';
import AppShell from './AppShell';

Amplify.configure(outputs);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Authenticator.Provider>
      <AppShell />
    </Authenticator.Provider>
  </React.StrictMode>
);
