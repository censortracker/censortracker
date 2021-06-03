import IPFS from 'ipfs'

class IPFSProxy {
  constructor () {
    setTimeout(async () => {
      this.node = await IPFS.create()
    }, 0)
  }

  get = async () => {
    const { cid } = await this.node.add({
      path: 'censortracker.config.json',
      content: JSON.stringify({
        proxy: true,
        name: 'CensorTracker',
      }),
    })

    const chunks = []

    for await (const chunk of this.node.files.read(cid)) {
      chunks.push(chunk)
    }

    return JSON.parse(chunks.toString())
  }
}

export default new IPFSProxy()
