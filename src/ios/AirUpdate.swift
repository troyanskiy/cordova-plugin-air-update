//import Foundation

@objc(AirUpdate) class AirUpdate : CDVPlugin {
    override func pluginInitialize() {
        self.reloadInner();
    }

    @objc(reload:)
    func reload(command: CDVInvokedUrlCommand) {
        self.reloadInner();
        self.commandDelegate!.send(
            CDVPluginResult(
                status: CDVCommandStatus_OK
            ),
            callbackId: command.callbackId
        );
    }

    private func reloadInner() {
        let libPath = NSSearchPathForDirectoriesInDomains(.libraryDirectory, .userDomainMask, true)[0];

        let jsonPath = libPath + "/NoCloud/AirUpdate/current.json";
        var jsonIsFile : ObjCBool = false;

        let fileManager = FileManager.default;

        if (fileManager.fileExists(atPath: jsonPath, isDirectory: &jsonIsFile)) {
            jsonIsFile = jsonIsFile.boolValue ? false : true;
        }

        if (jsonIsFile.boolValue) {

            let currentJSON = self.readJson(file: URL.init(fileURLWithPath: jsonPath));

            let wwwDirName = "www_" + (currentJSON["channelKey"] as! String) + "_" + (currentJSON["version"] as! String);

            let wwwPath = libPath + "/NoCloud/AirUpdate/" + wwwDirName;
            var wwwIsDir : ObjCBool = false;

            fileManager.fileExists(atPath: wwwPath, isDirectory: &wwwIsDir);
            if (wwwIsDir.boolValue) {
                let components = NSURLComponents();
                components.scheme = "file";
                components.path = wwwPath + "/index.html";

                DispatchQueue.main.async(execute: {
                    print("Redirecring");
                    let reloadSelector = NSSelectorFromString("reload");

                    let handle : UnsafeMutableRawPointer! = dlopen("/usr/lib/libobjc.A.dylib", RTLD_NOW);
                    unsafeBitCast(dlsym(handle, "objc_msgSend"), to:(@convention(c)(Any?,Selector!)->Void).self)(self.webView,reloadSelector);
                    dlclose(handle);

                    self.webViewEngine.load(URLRequest(url: components.url!));
                });

            }

        }

    }

    private func readJson(file: URL) -> [String: Any] {
        do {
            let data = try Data(contentsOf: file);
            let json = try JSONSerialization.jsonObject(with: data, options: []);
            if let object = json as? [String: Any] {
                return object;
            }
        } catch {
            print(error.localizedDescription);
        }

        return [:];

    }

}
