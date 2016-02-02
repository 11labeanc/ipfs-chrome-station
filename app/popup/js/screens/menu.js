/* global chrome */
import React, {Component} from 'react'
import CSSTransitionGroup from 'react-addons-css-transition-group'
import { url as isIPFSUrl } from 'is-ipfs'

import StartScreen from './menu/start'
import ProfileScreen from './menu/profile'
import Loader from '../components/view/loader'

import '../../styles/animations.less'

const INITIALIZING = 'initializing'
const RUNNING = 'running'
const STOPPED = 'stopped'

const WEB_UI_URL = 'http://localhost:5001/ipfs/QmRyWyKWmphamkMRnJVjUTzSFSAAZowYP4rnbgnfMXC9Mr'
const IPFS_PATTERN = /^https?:\/\/[^\/]+\/(ip(f|n)s)\/(\w+)/

function copyToClipboard (str) {
  document.oncopy = (event) => {
    event.clipboardData.setData('Text', str)
    event.preventDefault()
  }

  document.execCommand('Copy')
  document.oncopy = undefined
}

function parseIpfsUrl (url) {
  const matches = url.match(IPFS_PATTERN)
  const hash = matches[3]
  const address = `/${matches[1]}/${hash}`
  const publicUrl = `https://ipfs.io${address}`

  return {
    hash,
    address,
    publicUrl
  }
}

export default class Menu extends Component {

  state = {
    status: INITIALIZING,
    connected: false,
    version: null,
    stats: {}
  };

  constructor (props) {
    super(props)

    this.handleStorageChange = this.handleStorageChange.bind(this)
    this.handleRedirectClick = this.handleRedirectClick.bind(this)
    this.handleWebUIClick = this.handleWebUIClick.bind(this)
    this.handleOptionsClick = this.handleOptionsClick.bind(this)
    this.handleCopyToClipboard = this.handleCopyToClipboard.bind(this)
    this.handlePinClick = this.handlePinClick.bind(this)

    chrome.storage.onChanged.addListener(this.handleStorageChange)

    chrome.storage.local.get(null, (result) => {
      this.setState({
        ...result,
        status: result.running ? RUNNING : STOPPED
      })
    })

    chrome.storage.sync.get(null, (result) => {
      this.setState(result)
    })

    chrome.tabs.query({ currentWindow: true, active: true }, (tabs) => {
      if (!isIPFSUrl(tabs[0].url)) {
        return
      }

      const pageUrl = tabs[0].url

      const { hash } = parseIpfsUrl(pageUrl)

      this.setState({
        isIpfsPage: true,
        pageUrl,
        pageHash: hash
      })

      chrome.runtime.sendMessage({ method: 'pin.list' }, (response) => {
        const err = response[0]
        const res = response[1]
        if (err) {
          console.error('error on pin.list', err)
          return
        }

        this.setState({
          pinned: !!res.Keys[hash]
        })
      })
    })
  }

  handleStorageChange (changes, namespace) {
    const nextState = {}
    Object.keys(changes).forEach(key => {
      const storageChange = changes[key]

      nextState[key] = storageChange.newValue

      if (key === 'running') {
        nextState.status = storageChange.newValue ? RUNNING : STOPPED
      }
    })

    console.log('nextState', nextState)

    this.setState(nextState)
  }

  handleRedirectClick () {
    const redirecting = !this.state.redirecting

    chrome.storage.sync.set({
      redirecting
    })
  }

  handleWebUIClick () {
    chrome.tabs.create({ url: WEB_UI_URL })
  }

  handleOptionsClick () {
    chrome.runtime.openOptionsPage()
  }

  handleCopyToClipboard (type) {
    const { address, publicUrl } = parseIpfsUrl(this.state.pageUrl)

    switch (type) {
      case 'public-address':
        return copyToClipboard(publicUrl)
      case 'address':
        return copyToClipboard(address)
    }
  }

  handlePinClick () {
    const method = this.state.pinned ? 'pin.remove' : 'pin.add'

    const args = [this.state.pageHash]

    chrome.runtime.sendMessage({ method, args }, (response) => {
      const err = response[0]
      if (err) {
        console.error('error on', method, err)
        return
      }

      this.setState({
        pinned: !this.state.pinned
      })
    })
  }

  getScreen () {
    switch (this.state.status) {
      case RUNNING:
        return (
          <ProfileScreen
            key='profile-screen'
            agentVersion={this.state.agentVersion}
            protocolVersion={this.state.protocolVersion}
            host={this.state.host}
            port={this.state.port}
            peers={this.state.peersCount}
            location={this.state.location}
            redirecting={this.state.redirecting}
            pinned={this.state.pinned}
            isIpfsPage={this.state.isIpfsPage}
            pageUrl={this.state.pageUrl}
            onOptionsClick={this.handleOptionsClick}
            onRedirectClick={this.handleRedirectClick}
            onWebUIClick={this.handleWebUIClick}
            onCopyToClipboard={this.handleCopyToClipboard}
            onPinClick={this.handlePinClick}
            />
        )
      case INITIALIZING:
        return <Loader key='loader-screen' />
      default:
        return <StartScreen key='start-screen' onStartClick={this._startDaemon}/>
    }
  }

  render () {
    return (
      <CSSTransitionGroup
        transitionName='fade'
        transitionEnterTimeout={300}
        transitionLeaveTimeout={200}
        >
        {this.getScreen()}
      </CSSTransitionGroup>
    )
  }
}
