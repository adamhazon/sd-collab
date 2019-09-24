import React, { Component } from "react";
import socketIOClient from "socket.io-client";

// ProseMirror
import {EditorState} from "prosemirror-state";
import {EditorView} from "prosemirror-view";
import {Step} from "prosemirror-transform"
import {schema} from "prosemirror-schema-basic";
import {undo, redo, history} from "prosemirror-history";
import {keymap} from "prosemirror-keymap";
import {baseKeymap} from "prosemirror-commands"
import * as collab from "prosemirror-collab";

import './App.css';

const IO_ENDPOINT = '/';
const SOCKET = socketIOClient(IO_ENDPOINT);

class App extends Component {
  editorView = null;

  collabEditor(authority) {
    let view = new EditorView(document.querySelector("#editor"), {
      state: EditorState.create({
        doc: schema.nodeFromJSON(authority.doc),
        plugins: [
          collab.collab({version: authority.steps.length}),
          history(),
          keymap({"Mod-z": undo, "Mod-Shift-z": redo}),
          keymap(baseKeymap)
        ]
      }),
      dispatchTransaction(transaction) {
        let newState = view.state.apply(transaction);
        view.updateState(newState);
        let sendable = collab.sendableSteps(newState);
        if (sendable) {
          SOCKET.emit('FromClient', JSON.stringify({
            version: sendable.version,
            steps: sendable.steps.map(step => step.toJSON()) || [],
            clientID: sendable.clientID
          }));
        }
      }
    });

    return view;
  }

  componentDidMount() {
    SOCKET.on("FromServer", newData => {
      const jsonData = JSON.parse(newData);

      if (!this.editorView) {
        this.editorView = this.collabEditor(jsonData.authority);
      } else {
        this.editorView.dispatch(
          collab.receiveTransaction(
            this.editorView.state,
            jsonData.steps.map(step => Step.fromJSON(schema, step)),
            jsonData.clientIDs
          )
        );
      }
    });
  }

  render() {
    return (
      <div className="view">
        <p>Editor:</p>
        <div className="editorWrapper" id="editor" />
      </div>
    );
  }
}

export default App;
