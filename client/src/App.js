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

class App extends Component {
  constructor() {
    super();
    this.state = {
      authority: {
        doc: schema.node("doc", null, [schema.node("paragraph", null, [
          schema.text("This is a collaborative test document. Start editing to make it more interesting!")
        ])]),
        steps: [],
        stepClientIDs: []
      },
    };
  }

  componentDidMount() {
    const { authority } = this.state;
    const socket = socketIOClient(IO_ENDPOINT);

    let view = new EditorView(document.querySelector("#editor"), {
      state: EditorState.create({
        doc: authority.doc,
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
          socket.emit('FromClient', JSON.stringify({
            version: sendable.version,
            steps: sendable.steps.map(step => step.toJSON()) || [],
            clientID: sendable.clientID
          }));
        }
      }
    });

    socket.on("FromServer", newData => {
      this.setState({authority: newData.authority});
      view.dispatch(
        collab.receiveTransaction(
          view.state,
          newData.steps.map(step => Step.fromJSON(schema, step)),
          newData.clientIDs
        )
      );
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
