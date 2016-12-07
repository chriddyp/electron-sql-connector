import React, {Component, PropTypes} from 'react';
import ImmutablePropTypes from 'react-immutable-proptypes';
import classnames from 'classnames';
import * as styles from './ConnectButton.css';
import {APP_STATUS, BUTTON_MESSAGE} from '../../../constants/constants';

export default class ConnectButton extends Component {

    render() {
        const {
            connectionsHaveBeenSaved,
            connect,
            connectRequest,
            saveConnectionsRequest,
            editMode
        } = this.props;

        let buttonText;
        let buttonClick = () => {};
        let error = null;

        if (connectRequest.status >= 400 || saveConnectionsRequest.status >= 400) {
           buttonText = 'Connect';
           buttonClick = connect;
           // TODO - Try out locking the home folder and verifying this.
           let errorMessage = 'Hm... had trouble connecting.';
           if (connectRequest.content && connectRequest.content.error) {
               errorMessage = connectRequest.content.error;
           } else if (saveConnectionsRequest.content && saveConnectionsRequest.content.error && saveConnectionsRequest.content.error.message) {
               errorMessage = saveConnectionsRequest.content.error.message;
           }
           error = <div className={styles.errorMessage}>{errorMessage}</div>;
       } else if (!connectRequest.status) {
            buttonText = 'Connect';
            buttonClick = connect;
        } else if (connectRequest.status === 'loading') {
            buttonText = 'Connecting...';
        } else if (connectRequest.status >= 200 && connectRequest.status < 300) {
            if (editMode) {
                buttonText = 'Save changes';
                buttonClick = connect;
            } else {
                buttonText = 'Connected';
            }
        }

       return (
            <div className={styles.connectButtonContainer}>
                <div
                    className={styles.buttonPrimary}
                    onClick={buttonClick}
                >
                    {buttonText}
                </div>
                    {error}
            </div>
       );
    }
}
